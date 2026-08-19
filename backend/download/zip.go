package download

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Blacklisted paths that are skipped during overrides extraction.
var blacklistedPaths = []string{
	"overrides/options.txt",
	"overrides/shaderpacks",
	"overrides/essential",
	"overrides/resourcepacks",
	"overrides/PCL",
	"overrides/CustomSkinLoader",
	"overrides/servers.dat",
}

// ZipInfo contains parsed information from a modpack ZIP.
type ZipInfo struct {
	ManifestType string         // "manifest.json" or "modrinth.index.json"
	ManifestData map[string]any // parsed manifest content
	FileCount    int            // total entries in the ZIP
}

// UnzipProgress represents progress during ZIP extraction.
type UnzipProgress struct {
	FileName string
	Total    int
	Current  int
}

// isBlacklistedEntry checks if a ZIP entry path should be skipped during extraction.
func isBlacklistedEntry(filename string) bool {
	if filename == "overrides/" || filename == "overrides" {
		return true
	}

	for _, item := range blacklistedPaths {
		normalizedItem := item
		if !strings.HasSuffix(normalizedItem, "/") {
			normalizedItem += "/"
		}
		normalizedFilename := filename
		if !strings.HasSuffix(normalizedFilename, "/") {
			normalizedFilename += "/"
		}
		if normalizedFilename == normalizedItem || strings.HasPrefix(normalizedFilename, normalizedItem) {
			return true
		}
	}
	return false
}

// ExtractMrpackFromZip extracts a nested modpack.mrpack from a PCL-style ZIP.
// If the ZIP does not contain modpack.mrpack, returns the original buffer unchanged.
func ExtractMrpackFromZip(buffer []byte, filename ...string) ([]byte, error) {
	if len(filename) > 0 && !strings.HasSuffix(filename[0], ".zip") {
		return buffer, nil
	}

	reader, err := zip.NewReader(bytes.NewReader(buffer), int64(len(buffer)))
	if err != nil {
		return buffer, nil // not a valid zip, return original
	}

	for _, f := range reader.File {
		if f.Name == "modpack.mrpack" {
			rc, err := f.Open()
			if err != nil {
				return nil, fmt.Errorf("failed to open modpack.mrpack: %w", err)
			}
			defer rc.Close()

			data, err := io.ReadAll(rc)
			if err != nil {
				return nil, fmt.Errorf("failed to read modpack.mrpack: %w", err)
			}
			return data, nil
		}
	}

	// No modpack.mrpack found, return original buffer
	return buffer, nil
}

// ProcessZipEntries scans a ZIP buffer for manifest.json or modrinth.index.json
// and returns parsed information about the modpack.
func ProcessZipEntries(buffer []byte) (*ZipInfo, error) {
	if len(buffer) == 0 {
		return nil, fmt.Errorf("zip data is empty")
	}

	reader, err := zip.NewReader(bytes.NewReader(buffer), int64(len(buffer)))
	if err != nil {
		return nil, fmt.Errorf("failed to open zip: %w", err)
	}

	importantFiles := []string{"manifest.json", "modrinth.index.json"}

	for _, f := range reader.File {
		for _, important := range importantFiles {
			if f.Name == important {
				rc, err := f.Open()
				if err != nil {
					continue
				}

				data, err := io.ReadAll(rc)
				rc.Close()
				if err != nil {
					continue
				}

				var manifest map[string]any
				if err := json.Unmarshal(data, &manifest); err != nil {
					continue
				}

				return &ZipInfo{
					ManifestType: important,
					ManifestData: manifest,
					FileCount:    len(reader.File),
				}, nil
			}
		}
	}

	return nil, fmt.Errorf("no manifest file found in modpack (expected manifest.json or modrinth.index.json)")
}

// UnzipOverrides extracts the overrides/ directory from a ZIP buffer into the instance directory.
// Files matching the blacklist are skipped. Existing files are not overwritten.
func UnzipOverrides(zipData []byte, instanceName string, appDir string, progressFn func(UnzipProgress)) error {
	reader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return fmt.Errorf("failed to open zip: %w", err)
	}

	instancePath := filepath.Join(appDir, "instance", instanceName)
	total := len(reader.File)

	for idx, f := range reader.File {
		if progressFn != nil {
			progressFn(UnzipProgress{
				FileName: f.Name,
				Total:    total,
				Current:  idx + 1,
			})
		}

		// Skip non-overrides entries
		if !strings.HasPrefix(f.Name, "overrides/") {
			continue
		}

		// Skip the overrides/ directory itself
		if f.Name == "overrides/" {
			continue
		}

		// Skip blacklisted entries
		if isBlacklistedEntry(f.Name) {
			continue
		}

		// Compute target path (strip "overrides/" prefix)
		targetPath := strings.TrimPrefix(f.Name, "overrides/")

		if f.FileInfo().IsDir() {
			dirPath := filepath.Join(instancePath, targetPath)
			if err := os.MkdirAll(dirPath, 0o755); err != nil {
				return err
			}
			continue
		}

		// Ensure parent directory exists
		fullPath := filepath.Join(instancePath, targetPath)
		dirPath := filepath.Dir(fullPath)
		if err := os.MkdirAll(dirPath, 0o755); err != nil {
			return err
		}

		// Skip if file already exists
		if _, err := os.Stat(fullPath); err == nil {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			return fmt.Errorf("failed to open zip entry %s: %w", f.Name, err)
		}

		data, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return fmt.Errorf("failed to read zip entry %s: %w", f.Name, err)
		}

		if err := os.WriteFile(fullPath, data, 0o644); err != nil {
			return fmt.Errorf("failed to write file %s: %w", fullPath, err)
		}
	}

	return nil
}
