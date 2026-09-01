package util

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// CleanupInstallFiles removes installer artifacts after server installation
func CleanupInstallFiles(instancePath string) {
	filesToClean := []string{}

	// 1. Collect forge-*-installer.jar and forge-*-installer.jar.log files
	entries, err := os.ReadDir(instancePath)
	if err != nil {
		Logger.Warn(fmt.Sprintf("Failed to read instance directory: %v", err))
		return
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		// Match forge installer files
		if strings.HasPrefix(name, "forge-") &&
			(strings.HasSuffix(name, "-installer.jar") ||
				strings.HasSuffix(name, "-installer.jar.log")) {
			filesToClean = append(filesToClean, filepath.Join(instancePath, name))
		}
	}

	// 2. Collect fabric-installer.jar file
	fabricInstaller := filepath.Join(instancePath, "fabric-installer.jar")
	if _, err := os.Stat(fabricInstaller); err == nil {
		filesToClean = append(filesToClean, fabricInstaller)
	}

	// 3. Collect installer.log file
	installerLog := filepath.Join(instancePath, "installer.log")
	if _, err := os.Stat(installerLog); err == nil {
		filesToClean = append(filesToClean, installerLog)
	}

	// Delete files
	for _, file := range filesToClean {
		err := os.Remove(file)
		if err != nil {
			Logger.Warn(fmt.Sprintf("Failed to clean file %s: %v", filepath.Base(file), err))
		} else {
			Logger.Info(fmt.Sprintf("Cleaned installer file: %s", filepath.Base(file)))
		}
	}
}