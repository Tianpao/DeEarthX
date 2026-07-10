package java

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"deearthx/core/util"
)

// JavaVersion represents parsed Java version information
type JavaVersion struct {
	Major          int    `json:"major"`
	Minor          int    `json:"minor"`
	Patch          int    `json:"patch"`
	FullVersion    string `json:"fullVersion"`
	Vendor         string `json:"vendor"`
	RuntimeVersion string `json:"runtimeVersion,omitempty"`
}

// JavaCheckResult represents the result of a Java check
type JavaCheckResult struct {
	Exists  bool         `json:"exists"`
	Version *JavaVersion `json:"version,omitempty"`
	Error   string       `json:"error,omitempty"`
}

// VersionCompare compares two version strings
// Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
func VersionCompare(v1, v2 string) int {
	a := strings.Split(v1, ".")
	b := strings.Split(v2, ".")
	maxLen := max(len(a), len(b))

	for i := 0; i < maxLen; i++ {
		av := 0
		bv := 0
		if i < len(a) {
			av, _ = strconv.Atoi(a[i])
		}
		if i < len(b) {
			bv, _ = strconv.Atoi(b[i])
		}
		if av != bv {
			if av > bv {
				return 1
			}
			return -1
		}
	}
	return 0
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// CheckJava checks if Java is available and returns version info
func CheckJava(javaPath string) JavaCheckResult {
	cmd := javaPath
	if cmd == "" {
		cmd = "java"
	}

	// Run java -version
	execCmd := exec.Command(cmd, "-version")
	output, err := execCmd.CombinedOutput()
	if err != nil {
		util.Logger.Error(fmt.Sprintf("Java check failed: %v", err))
		return JavaCheckResult{
			Exists: false,
			Error:  err.Error(),
		}
	}

	util.Logger.Debug(fmt.Sprintf("Java version output: %s", output))

	// Parse version
	versionRegex := regexp.MustCompile(`version "(\d+)(\.(\d+))?(\.(\d+))?`)
	vendorRegex := regexp.MustCompile(`(Java\(TM\)|OpenJDK).*Runtime Environment.*by (.*)`)

	versionMatch := versionRegex.FindStringSubmatch(string(output))
	vendorMatch := vendorRegex.FindStringSubmatch(string(output))

	if versionMatch == nil {
		return JavaCheckResult{
			Exists: true,
			Error:  "Failed to parse Java version",
		}
	}

	major, _ := strconv.Atoi(versionMatch[1])
	minor := 0
	patch := 0
	if len(versionMatch) > 3 && versionMatch[3] != "" {
		minor, _ = strconv.Atoi(versionMatch[3])
	}
	if len(versionMatch) > 5 && versionMatch[5] != "" {
		patch, _ = strconv.Atoi(versionMatch[5])
	}

	vendor := "Unknown"
	if vendorMatch != nil && len(vendorMatch) > 2 {
		vendor = vendorMatch[2]
	}

	versionInfo := &JavaVersion{
		Major:          major,
		Minor:          minor,
		Patch:          patch,
		FullVersion:    strings.TrimPrefix(versionMatch[0], "version "),
		Vendor:         vendor,
		RuntimeVersion: string(output),
	}

	util.Logger.Info(fmt.Sprintf("Detected Java: %+v", versionInfo))

	return JavaCheckResult{
		Exists:  true,
		Version: versionInfo,
	}
}

// DetectJavaPaths scans common Java installation directories
func DetectJavaPaths() []string {
	var javaPaths []string

	// Common Windows Java installation paths
	windowsPaths := []string{
		`C:\Program Files\Java\`,
		`C:\Program Files (x86)\Java\`,
		`C:\Program Files\Eclipse Adoptium\`,
		`C:\Program Files\Eclipse Foundation\`,
		`C:\Program Files\Microsoft\`,
		`C:\Program Files\Amazon Corretto\`,
		`C:\Program Files\BellSoft\`,
		`C:\Program Files\Zulu\`,
		`C:\Program Files\Semeru\`,
		`C:\Program Files\Oracle\`,
		`C:\Program Files\RedHat\`,
	}

	for _, basePath := range windowsPaths {
		entries, err := os.ReadDir(basePath)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			javaExe := filepath.Join(basePath, entry.Name(), "bin", "java.exe")
			if _, err := os.Stat(javaExe); err == nil {
				javaPaths = append(javaPaths, javaExe)
			}
		}
	}

	// Check PATH environment
	execCmd := exec.Command("where", "java")
	output, err := execCmd.Output()
	if err == nil {
		scanner := bufio.NewScanner(bytes.NewReader(output))
		for scanner.Scan() {
			path := strings.TrimSpace(scanner.Text())
			if path != "" && !contains(javaPaths, path) {
				javaPaths = append(javaPaths, path)
			}
		}
	}

	// Remove duplicates
	return unique(javaPaths)
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func unique(slice []string) []string {
	keys := make(map[string]bool)
	result := []string{}
	for _, item := range slice {
		if !keys[item] {
			keys[item] = true
			result = append(result, item)
		}
	}
	return result
}