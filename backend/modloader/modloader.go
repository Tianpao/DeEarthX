package modloader

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"dex/backend/utils"
)

type XModloader interface {
	Setup() error
	Installer() error
}

func newModloader(ml string, mcv, mlv, path string) XModloader {
	switch ml {
	case "forge":
		return NewForge(mcv, mlv, path)
	case "neoforge":
		return NewNeoForge(mcv, mlv, path)
	case "fabric", "fabric-loader":
		return NewFabric(mcv, mlv, path)
	default:
		return NewMinecraft(ml, mcv, mlv, path)
	}
}

// MLSetup performs the full server-side setup: Minecraft server + mod loader + optional template.
// This is the main orchestration function for server mode installation.
func MLSetup(ml, mcv, mlv, path string, template ...string) error {
	tmpl := ""
	if len(template) > 0 {
		tmpl = template[0]
	}

	if tmpl != "" && tmpl != "0" {
		// Apply template: copy template files to install directory
		templatePath := filepath.Join(getAppDir(), "templates", tmpl)
		dataPath := filepath.Join(templatePath, "data")

		err := filepath.Walk(dataPath, func(srcPath string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if info.IsDir() {
				return nil
			}

			relPath, _ := filepath.Rel(dataPath, srcPath)
			destPath := filepath.Join(path, relPath)
			destDir := filepath.Dir(destPath)

			if err := os.MkdirAll(destDir, 0o755); err != nil {
				return err
			}

			data, err := os.ReadFile(srcPath)
			if err != nil {
				return err
			}

			return os.WriteFile(destPath, data, 0o644)
		})

		if err != nil {
			return fmt.Errorf("failed to apply template %s: %w", tmpl, err)
		}
	} else {
		// Step 1: Install Minecraft server
		fmt.Println("Step 1: Installing Minecraft Server")
		minecraft := NewMinecraft(ml, mcv, mlv, path)
		if err := minecraft.Setup(); err != nil {
			return fmt.Errorf("minecraft server setup failed: %w", err)
		}

		// Step 2: Install mod loader
		fmt.Println("Step 2: Installing Mod Loader")
		loader := newModloader(ml, mcv, mlv, path)
		if err := loader.Setup(); err != nil {
			return fmt.Errorf("mod loader setup failed: %w", err)
		}
	}

	// Cleanup installer files and logs
	cleanupInstallFiles(path)

	return nil
}

// DInstall performs a lightweight install: only downloads the installer jar
// and writes batch/shell scripts for manual execution.
func DInstall(ml, mcv, mlv, path string) error {
	loader := newModloader(ml, mcv, mlv, path)
	if err := loader.Installer(); err != nil {
		return fmt.Errorf("installer download failed: %w", err)
	}

	var cmd string
	if ml == "forge" || ml == "neoforge" {
		cmd = fmt.Sprintf("java -jar forge-%s-%s-installer.jar --installServer", mcv, mlv)
	} else if ml == "fabric" || ml == "fabric-loader" {
		// Write run scripts for Fabric
		runBat := "@echo off\njava -jar fabric-server-launch.jar\n"
		runSh := "#!/bin/bash\njava -jar fabric-server-launch.jar\n"
		os.WriteFile(filepath.Join(path, "run.bat"), []byte(runBat), 0o644)
		os.WriteFile(filepath.Join(path, "run.sh"), []byte(runSh), 0o644)

		cmd = fmt.Sprintf("java -jar fabric-installer.jar server -dir . -mcversion %s -loader %s -downloadMinecraft", mcv, mlv)
	}

	if cmd != "" {
		installBat := fmt.Sprintf("@echo off\n%s\necho Install Successfully,Enter Some Key to Exit!\npause\n", cmd)
		installSh := fmt.Sprintf("#!/bin/bash\n%s\n", cmd)
		os.WriteFile(filepath.Join(path, "install.bat"), []byte(installBat), 0o644)
		os.WriteFile(filepath.Join(path, "install.sh"), []byte(installSh), 0o644)
	}

	return nil
}

// cleanupInstallFiles removes installer jars, log files, and residual temp download files after installation.
func cleanupInstallFiles(path string) {
	patterns := []string{
		"forge-*-installer.jar",
		"fabric-installer.jar",
		"*.log",
		"installer.log",
		"*.downloading", // residual temp files from interrupted downloads
	}

	for _, pattern := range patterns {
		matches, _ := filepath.Glob(filepath.Join(path, pattern))
		for _, match := range matches {
			os.Remove(match)
		}
	}

	// Also clean up .downloading files in the libraries/ subdirectory
	libPatterns := filepath.Join(path, "libraries", "**", "*.downloading")
	libMatches, _ := filepath.Glob(libPatterns)
	for _, match := range libMatches {
		os.Remove(match)
	}
}

// getAppDir returns the application data directory.
func getAppDir() string {
	// Try XDG data home first
	if xdg := os.Getenv("XDG_DATA_HOME"); xdg != "" {
		return filepath.Join(xdg, "DeEarthX")
	}

	// Fallback to platform-specific app data dir
	if appData := os.Getenv("APPDATA"); appData != "" {
		return filepath.Join(appData, "DeEarthX")
	}

	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".local", "share", "DeEarthX")
}

// getJavaCmd returns the Java command path from config, or "java" as default.
func getJavaCmd() string {
	javaPath := utils.GlobalConfig.GetConfigValue("javaPath")
	if s, ok := javaPath.(string); ok && s != "" {
		return s
	}
	return "java"
}

// parseJSON is a helper to parse JSON bytes into a target struct.
func parseJSON(data []byte, v any) error {
	return json.Unmarshal(data, v)
}
