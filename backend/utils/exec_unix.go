//go:build !windows

package utils

import "os/exec"

// runShellCommand runs a command line via /bin/sh and returns combined output.
func runShellCommand(command, cwd string) ([]byte, error) {
	cmd := exec.Command("sh", "-c", command)
	if cwd != "" {
		cmd.Dir = cwd
	}
	return cmd.CombinedOutput()
}