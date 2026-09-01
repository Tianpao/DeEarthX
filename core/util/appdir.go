package util

import (
	"os"
	"path/filepath"
	"strings"
)

// GetAppDir returns the application directory
// In development: returns current working directory
// In production: returns executable's directory
func GetAppDir() string {
	execPath, err := os.Executable()
	if err != nil {
		return "."
	}

	execName := filepath.Base(execPath)
	cwd, err := os.Getwd()
	if err != nil {
		cwd = "."
	}

	// Development mode: running under node.exe or go run
	isDev := strings.Contains(strings.ToLower(execName), "node") ||
		strings.Contains(strings.ToLower(execName), "go") ||
		!strings.Contains(strings.ToLower(cwd), "program files") &&
			!strings.Contains(strings.ToLower(execPath), "program files") &&
			execName == "main"

	if isDev {
		return cwd
	}

	return filepath.Dir(execPath)
}