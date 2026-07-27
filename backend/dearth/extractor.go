package dearth

import (
	"archive/zip"
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"io"
	"os"
	"path/filepath"
	"strings"

	"dex/backend/dearth/types"
)

// FileExtractor scans a directory for .jar files and extracts metadata.
type FileExtractor struct {
	modsPath string
}

func NewFileExtractor(modsPath string) *FileExtractor {
	if !filepath.IsAbs(modsPath) {
		abs, _ := filepath.Abs(modsPath)
		modsPath = abs
	}
	return &FileExtractor{modsPath: modsPath}
}

// ExtractFilesInfo scans all .jar files and extracts SHA1, MurmurHash2, mixin configs, and mod metadata.
func (fe *FileExtractor) ExtractFilesInfo() ([]types.FileInfo, error) {
	jarFiles, err := fe.getJarFiles()
	if err != nil {
		return nil, err
	}

	slog.Info("FileExtractor: found jar files", "count", len(jarFiles))

	files := make([]types.FileInfo, 0, len(jarFiles))
	for _, jarFilename := range jarFiles {
		fullPath := filepath.Join(fe.modsPath, jarFilename)

		fileData, err := os.ReadFile(fullPath)
		if err != nil {
			slog.Error("error reading file", "file", fullPath, "error", err)
			continue
		}

		h := sha1.Sum(fileData)
		files = append(files, types.FileInfo{
			Filename: fullPath,
			Hash:     hex.EncodeToString(h[:]),
			Murmur2:  MurmurHash2(fileData),
			Mixins:   extractMixins(fileData),
			Infos:    extractModInfo(fileData),
		})
	}

	return files, nil
}

func (fe *FileExtractor) getJarFiles() ([]string, error) {
	if err := os.MkdirAll(fe.modsPath, 0o755); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(fe.modsPath)
	if err != nil {
		return nil, err
	}
	var jars []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".jar") {
			jars = append(jars, e.Name())
		}
	}
	return jars, nil
}

// extractMixins extracts mixin configuration JSON files from a jar.
func extractMixins(fileData []byte) []types.MixinFile {
	var mixins []types.MixinFile
	r, err := zip.NewReader(bytes.NewReader(fileData), int64(len(fileData)))
	if err != nil {
		return mixins
	}
	for _, f := range r.File {
		name := strings.ToLower(f.Name)
		if (strings.HasPrefix(name, "mixins.") || strings.HasPrefix(name, "mixin.") ||
			strings.Contains(name, ".mixins.json") || strings.Contains(name, ".mixin.json")) &&
			strings.HasSuffix(name, ".json") && !f.FileInfo().IsDir() {
			data, err := readZipEntry(f)
			if err != nil {
				continue
			}
			mixins = append(mixins, types.MixinFile{Name: f.Name, Data: string(data)})
		}
	}
	return mixins
}

// extractModInfo extracts mod metadata files from a jar.
func extractModInfo(fileData []byte) []types.InfoFile {
	var infos []types.InfoFile
	r, err := zip.NewReader(bytes.NewReader(fileData), int64(len(fileData)))
	if err != nil {
		return infos
	}
	infoFiles := map[string]bool{
		"fabric.mod.json":     true,
		"mods.toml":           true,
		"neoforge.mods.toml":  true,
		"modrinth.index.json": true,
		"modrinth.json":       true,
		"quilt.mod.json":      true,
	}
	for _, f := range r.File {
		base := filepath.Base(f.Name)
		if infoFiles[base] && !f.FileInfo().IsDir() {
			data, err := readZipEntry(f)
			if err != nil {
				continue
			}
			infos = append(infos, types.InfoFile{Name: base, Data: string(data)})
		}
	}
	return infos
}

func readZipEntry(f *zip.File) ([]byte, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(rc)
}

// ExtractModIDsFromInfos extracts mod IDs from info files.
func ExtractModIDsFromInfos(infos []types.InfoFile) []string {
	var modIDs []string
	for _, info := range infos {
		switch info.Name {
		case "fabric.mod.json", "quilt.mod.json":
			var obj struct {
				ID string `json:"id"`
			}
			if json.Unmarshal([]byte(info.Data), &obj) == nil && obj.ID != "" {
				modIDs = append(modIDs, obj.ID)
			}
		case "mods.toml", "neoforge.mods.toml":
			for _, line := range strings.Split(info.Data, "\n") {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "modId") {
					if parts := strings.SplitN(line, "=", 2); len(parts) == 2 {
						id := strings.Trim(strings.TrimSpace(parts[1]), "\"'")
						if id != "" {
							modIDs = append(modIDs, id)
						}
					}
				}
			}
		case "modrinth.index.json", "modrinth.json":
			var obj struct {
				ProjectID string `json:"project_id"`
			}
			if json.Unmarshal([]byte(info.Data), &obj) == nil && obj.ProjectID != "" {
				modIDs = append(modIDs, obj.ProjectID)
			}
		}
	}
	return modIDs
}
