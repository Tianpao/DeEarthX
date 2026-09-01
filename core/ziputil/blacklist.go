package ziputil

import (
	"strings"
)

// Blacklisted paths for modpack extraction
// These paths are skipped during unzip to prevent unnecessary files
var blacklistedPaths = []string{
	"overrides/options.txt",
	"overrides/shaderpacks",
	"overrides/essential",
	"overrides/resourcepacks",
	"overrides/PCL",
	"overrides/CustomSkinLoader",
	"overrides/servers.dat",
}

// IsBlacklisted checks if a file path should be skipped during extraction
func IsBlacklisted(filename string) bool {
	// Skip the overrides directory itself
	if filename == "overrides/" || filename == "overrides" {
		return true
	}

	for _, item := range blacklistedPaths {
		normalizedItem := item
		if !strings.HasSuffix(item, "/") {
			normalizedItem = item + "/"
		}

		normalizedFilename := filename
		if !strings.HasSuffix(filename, "/") {
			normalizedFilename = filename + "/"
		}

		// Check exact match or prefix match
		if normalizedFilename == normalizedItem || strings.HasPrefix(normalizedFilename, normalizedItem) {
			return true
		}
	}

	return false
}

// ShouldSkipEntry determines if a zip entry should be skipped
func ShouldSkipEntry(entryName string) bool {
	// Skip non-overrides files
	if !strings.HasPrefix(entryName, "overrides/") {
		return true
	}

	// Skip the overrides directory itself
	if entryName == "overrides/" {
		return true
	}

	// Check blacklist
	return IsBlacklisted(entryName)
}