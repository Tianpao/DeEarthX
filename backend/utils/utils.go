package utils

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// GetAppDir returns the application data directory.
// Resolution order: XDG_DATA_HOME, APPDATA (Windows), ~/.local/share.
func GetAppDir() string {
	if xdg := os.Getenv("XDG_DATA_HOME"); xdg != "" {
		return filepath.Join(xdg, "DeEarthX")
	}
	if appData := os.Getenv("APPDATA"); appData != "" {
		return filepath.Join(appData, "DeEarthX")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".local", "share", "DeEarthX")
}

// ExecPromise runs a shell command in the given working directory and returns an error on failure.
func ExecPromise(command string, cwd ...string) error {
	var cmd *exec.Cmd
	// Use cmd.exe on Windows for bat files, sh otherwise
	if strings.HasSuffix(command, ".bat") || strings.Contains(command, ".bat ") {
		cmd = exec.Command("cmd", "/C", command)
	} else {
		cmd = exec.Command("sh", "-c", command)
	}

	if len(cwd) > 0 && cwd[0] != "" {
		cmd.Dir = cwd[0]
	}

	output, err := cmd.CombinedOutput()
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
