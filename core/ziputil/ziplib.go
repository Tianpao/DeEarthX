package ziputil

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// ZipEntry represents a single entry in a zip file
type ZipEntry struct {
	Name     string
	Data     []byte
	IsDir    bool
	Size     uint64
	Compress uint16
}

// ReadZip reads all entries from a zip file buffer
func ReadZip(buffer []byte) ([]ZipEntry, error) {
	reader, err := zip.NewReader(bytes.NewReader(buffer), int64(len(buffer)))
	if err != nil {
		return nil, err
	}

	entries := make([]ZipEntry, 0, len(reader.File))
	for _, file := range reader.File {
		data, err := readZipFile(file)
		if err != nil {
			// Skip directories or files we can't read
			if file.FileInfo().IsDir() {
				entries = append(entries, ZipEntry{
					Name:  file.Name,
					IsDir: true,
					Size:  file.UncompressedSize64,
				})
				continue
			}
			return nil, err
		}

		entries = append(entries, ZipEntry{
			Name:     file.Name,
			Data:     data,
			IsDir:    file.FileInfo().IsDir(),
			Size:     file.UncompressedSize64,
			Compress: file.Method,
		})
	}

	return entries, nil
}

// readZipFile reads the content of a single zip file entry
func readZipFile(file *zip.File) ([]byte, error) {
	rc, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	data, err := io.ReadAll(rc)
	if err != nil {
		return nil, err
	}
	return data, nil
}

// ExtractFile extracts a specific file from a zip buffer
func ExtractFile(buffer []byte, targetName string) ([]byte, error) {
	reader, err := zip.NewReader(bytes.NewReader(buffer), int64(len(buffer)))
	if err != nil {
		return nil, err
	}

	for _, file := range reader.File {
		if file.Name == targetName {
			return readZipFile(file)
		}
	}

	return nil, nil // File not found
}

// ExtractFilePrefix extracts files matching a prefix from a zip buffer
func ExtractFilePrefix(buffer []byte, prefix string) ([]ZipEntry, error) {
	reader, err := zip.NewReader(bytes.NewReader(buffer), int64(len(buffer)))
	if err != nil {
		return nil, err
	}

	entries := []ZipEntry{}
	for _, file := range reader.File {
		if bytes.HasPrefix([]byte(file.Name), []byte(prefix)) {
			data, err := readZipFile(file)
			if err != nil {
				if file.FileInfo().IsDir() {
					entries = append(entries, ZipEntry{
						Name:  file.Name,
						IsDir: true,
					})
					continue
				}
				return nil, err
			}
			entries = append(entries, ZipEntry{
				Name:  file.Name,
				Data:  data,
				IsDir: file.FileInfo().IsDir(),
			})
		}
	}

	return entries, nil
}

// CreateZip creates a zip archive from a directory
func CreateZip(sourceDir string, outputPath string) error {
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	outFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create zip file: %w", err)
	}
	defer outFile.Close()

	zipWriter := zip.NewWriter(outFile)
	defer zipWriter.Close()

	return filepath.Walk(sourceDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if path == sourceDir {
			return nil
		}

		relPath, err := filepath.Rel(sourceDir, path)
		if err != nil {
			return err
		}
		relPath = filepath.ToSlash(relPath)

		if info.IsDir() {
			_, err := zipWriter.Create(relPath + "/")
			return err
		}

		writer, err := zipWriter.Create(relPath)
		if err != nil {
			return err
		}

		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()

		_, err = io.Copy(writer, file)
		return err
	})
}

// HasFile checks if a file exists in the zip
func HasFile(buffer []byte, targetName string) bool {
	reader, err := zip.NewReader(bytes.NewReader(buffer), int64(len(buffer)))
	if err != nil {
		return false
	}

	for _, file := range reader.File {
		if file.Name == targetName {
			return true
		}
	}
	return false
}