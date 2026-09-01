package util

import (
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var otherInvalidPathChars = regexp.MustCompile(`[<>"/\\|?*]`)

// SanitizePathName turns a modpack name into a safe folder name (Windows-safe).
// Colon is replaced with the fullwidth Chinese colon "：" to keep the name readable.
func SanitizePathName(name string) string {
	cleaned := strings.ReplaceAll(name, ":", "：")
	cleaned = otherInvalidPathChars.ReplaceAllString(cleaned, "_")
	cleaned = strings.TrimRight(cleaned, " .")
	if cleaned == "" {
		return "modpack"
	}
	return cleaned
}

// WriteFile writes content to a file, creating directories if needed
func WriteFile(path, content string) error {
	// Ensure directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(path, []byte(content), 0644)
}

// CopyFile copies a single file from src to dst
func CopyFile(src, dst string) error {
	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}

	source, err := os.Open(src)
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destination.Close()

	_, err = io.Copy(destination, source)
	return err
}

// CopyDirectory recursively copies a directory from src to dst
func CopyDirectory(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}

		destPath := filepath.Join(dst, relPath)

		if info.IsDir() {
			return os.MkdirAll(destPath, info.Mode())
		}

		return CopyFile(path, destPath)
	})
}

// FileExists checks if a file exists
func FileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// IsDir checks if path is a directory
func IsDir(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}