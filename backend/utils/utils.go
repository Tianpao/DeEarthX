package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

var appDir string

// SetAppDir sets the application data directory.
// Called once at startup with the exe's directory.
func SetAppDir(dir string) {
	appDir = dir
}

// GetAppDir returns the application data directory.
// Defaults to the directory containing the executable.
func GetAppDir() string {
	if appDir != "" {
		return appDir
	}
	exe, err := os.Executable()
	if err != nil {
		// Fallback to current working directory
		wd, _ := os.Getwd()
		return wd
	}
	return filepath.Dir(exe)
}

// ExecPromise runs a shell command in the given working directory and returns an error on failure.
func ExecPromise(command string, cwd ...string) error {
	dir := ""
	if len(cwd) > 0 {
		dir = cwd[0]
	}

	output, err := runShellCommand(command, dir)
	if err != nil {
		return fmt.Errorf("command failed: %s\noutput: %s\nerror: %w", command, string(output), err)
	}

	return nil
}

// VersionCompare compares two dotted version strings.
// Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
// Non-numeric segments are treated as 0.
func VersionCompare(v1, v2 string) int {
	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}

	for i := 0; i < maxLen; i++ {
		var n1, n2 int
		if i < len(parts1) {
			n1, _ = strconv.Atoi(parts1[i])
		}
		if i < len(parts2) {
			n2, _ = strconv.Atoi(parts2[i])
		}

		switch {
		case n1 > n2:
			return 1
		case n1 < n2:
			return -1
		}
	}

	return 0
}
