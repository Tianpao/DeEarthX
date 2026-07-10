package ziputil

import (
	"archive/zip"
	"bytes"
	"io"
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
	// Implementation will use archive/zip to create
	// This is a placeholder for the full implementation
	return nil
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