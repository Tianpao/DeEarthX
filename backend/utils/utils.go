package utils

import (
	"fmt"
	"os/exec"
	"strings"
)

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

// VersionCompare compares two version strings.
// Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
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
			fmt.Sscanf(parts1[i], "%d", &n1)
		}
		if i < len(parts2) {
			fmt.Sscanf(parts2[i], "%d", &n2)
		}

		if n1 > n2 {
			return 1
		} else if n1 < n2 {
			return -1
		}
	}

	return 0
}
