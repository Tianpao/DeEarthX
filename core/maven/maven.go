package maven

import (
	"fmt"
	"strings"
)

// MavenToUrl converts a Maven coordinate to a repository path or URL
// Coordinate format: groupId:artifactId:version[:classifier@extension]
// Example: "org.ow2.asm:asm:9.9" -> "org/ow2/asm/asm/9.9/asm-9.9.jar"
func MavenToUrl(coordinate string, base string) string {
	parts := strings.Split(coordinate, ":")
	if len(parts) < 3 {
		return ""
	}

	groupId := parts[0]
	artifactId := parts[1]
	version := parts[2]

	// Parse classifier and extension
	classifier := ""
	extension := "jar"
	if len(parts) > 3 {
		classifierAndExt := parts[3]
		if idx := strings.Index(classifierAndExt, "@"); idx >= 0 {
			classifier = classifierAndExt[:idx]
			extension = classifierAndExt[idx+1:]
		} else {
			classifier = classifierAndExt
		}
	}

	// Build classifier suffix
	classifierSuffix := ""
	if classifier != "" {
		classifierSuffix = "-" + classifier
	}

	// Clean base URL
	basePath := strings.TrimSuffix(base, "/")

	// Convert groupId dots to slashes
	groupPath := strings.ReplaceAll(groupId, ".", "/")

	// Build file path
	filePath := fmt.Sprintf("%s/%s/%s/%s-%s%s.%s",
		groupPath, artifactId, version, artifactId, version, classifierSuffix, extension)

	// Return with base if provided
	if basePath == "" {
		return filePath
	}
	return basePath + "/" + filePath
}

// MTP (Maven To Path) converts a Maven coordinate to a library path
// Used by Forge and Fabric library handling
// Format: [groupId:artifactId:version] or [groupId:artifactId:version@extension]
func MTP(mavenCoord string) string {
	// Remove brackets if present
	cleaned := strings.Trim(mavenCoord, "[]")
	parts := strings.Split(cleaned, "@")

	originalName := parts[0]
	mappingType := "jar"
	if len(parts) > 1 {
		mappingType = parts[1]
	}

	x := strings.Split(originalName, ":")
	if len(x) < 3 {
		return ""
	}

	group := strings.ReplaceAll(x[0], ".", "/")
	artifact := x[1]
	version := x[2]

	if len(x) > 3 && x[3] != "" {
		// Has classifier
		return fmt.Sprintf("%s/%s/%s/%s-%s-%s.%s",
			group, artifact, version, artifact, version, x[3], mappingType)
	}

	return fmt.Sprintf("%s/%s/%s/%s-%s.%s",
		group, artifact, version, artifact, version, mappingType)
}

// ParseMavenCoordinate parses a Maven coordinate string into its components
type MavenCoordinate struct {
	GroupID    string
	ArtifactID string
	Version    string
	Classifier string
	Extension  string
}

func ParseMavenCoordinate(coordinate string) MavenCoordinate {
	result := MavenCoordinate{
		Extension: "jar",
	}

	parts := strings.Split(coordinate, ":")
	if len(parts) >= 1 {
		result.GroupID = parts[0]
	}
	if len(parts) >= 2 {
		result.ArtifactID = parts[1]
	}
	if len(parts) >= 3 {
		result.Version = parts[2]
	}
	if len(parts) >= 4 {
		classifierAndExt := parts[3]
		if idx := strings.Index(classifierAndExt, "@"); idx >= 0 {
			result.Classifier = classifierAndExt[:idx]
			result.Extension = classifierAndExt[idx+1:]
		} else {
			result.Classifier = classifierAndExt
		}
	}

	return result
}