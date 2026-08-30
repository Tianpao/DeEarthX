package modloader

import (
	"fmt"
	"path/filepath"

	"deearthx/core/config"
	"deearthx/core/util"
)

// XModloader defines the interface for mod loader installers
type XModloader interface {
	Setup(progress ProgressCallback) error
	Installer() error
	Install() error
}

// ProgressCallback is called during installation progress
type ProgressCallback func(step string, current int, total int)

// Modloader creates a mod loader handler based on type
func Modloader(ml, mcv, mlv, path string) XModloader {
	switch ml {
	case "fabric", "fabric-loader":
		return NewFabric(mcv, mlv, path)
	case "forge":
		return NewForge(mcv, mlv, path)
	case "neoforge":
		return NewNeoForge(mcv, mlv, path)
	default:
		return NewMinecraft(ml, mcv, mlv, path)
	}
}

// MLSetup performs modpack server setup
func MLSetup(ml, mcv, mlv, path string, template string, progress ProgressCallback) error {
	util.Logger.Info("Starting server installation: " + ml + " " + mcv + "-" + mlv)

	// Template mode: only copy template data (matches TS mlsetup behavior)
	if template != "" && template != "0" {
		if progress != nil {
			progress("Applying Template: "+template, 1, 1)
		}
		util.Logger.Info("[MLSetup] Apply template only", "template", template)
		if err := ApplyTemplate(template, path); err != nil {
			util.Logger.Error("[MLSetup] Apply template FAILED", "error", err.Error())
			return err
		}
		util.CleanupInstallFiles(path)
		util.Logger.Info("Server installation complete (template)")
		return nil
	}

	totalSteps := 2

	// Step 1: Install Minecraft server
	if progress != nil {
		progress("Installing Minecraft Server", 1, totalSteps)
	}

	util.Logger.Info("[MLSetup] Step 1: Minecraft setup", "loader", ml, "mc", mcv)
	minecraft := NewMinecraft(ml, mcv, mlv, path)
	err := minecraft.Setup(progress)
	if err != nil {
		util.Logger.Error("[MLSetup] Minecraft setup FAILED", "error", err.Error())
		return err
	}
	util.Logger.Info("[MLSetup] Step 1 complete")

	// Step 2: Install mod loader
	if progress != nil {
		progress("Installing "+ml+" Loader", 2, totalSteps)
	}

	util.Logger.Info("[MLSetup] Step 2: Loader setup", "loader", ml)
	loader := Modloader(ml, mcv, mlv, path)
	err = loader.Setup(progress)
	if err != nil {
		util.Logger.Error("[MLSetup] Loader setup FAILED", "error", err.Error())
		return err
	}
	util.Logger.Info("[MLSetup] Step 2 complete")

	// Cleanup installer files
	util.CleanupInstallFiles(path)

	util.Logger.Info("Server installation complete")
	return nil
}

// DInstall generates installation scripts without running them
func DInstall(ml, mcv, mlv, path string) error {
	loader := Modloader(ml, mcv, mlv, path)
	err := loader.Installer()
	if err != nil {
		return err
	}

	// Generate install scripts
	return generateInstallScripts(ml, mcv, mlv, path)
}

func generateInstallScripts(ml, mcv, mlv, path string) error {
	var cmd string

	switch ml {
	case "forge", "neoforge":
		cmd = "java -jar forge-" + mcv + "-" + mlv + "-installer.jar --installServer"
	case "fabric", "fabric-loader":
		// Upload mode: provide launch scripts for fabric-server-launch.jar (matches TS dinstall)
		if err := util.WriteFile(filepath.Join(path, "run.bat"), "@echo off\njava -jar fabric-server-launch.jar\n"); err != nil {
			return err
		}
		if err := util.WriteFile(filepath.Join(path, "run.sh"), "#!/bin/bash\njava -jar fabric-server-launch.jar\n"); err != nil {
			return err
		}
		cmd = "java -jar fabric-installer.jar server -dir . -mcversion " + mcv + " -loader " + mlv + " -downloadMinecraft"
	}

	if cmd != "" {
		batContent := "@echo off\n" + cmd + "\necho Install Successfully,Enter Some Key to Exit!\npause\n"
		shContent := "#!/bin/bash\n" + cmd + "\n"

		if err := util.WriteFile(filepath.Join(path, "install.bat"), batContent); err != nil {
			return err
		}
		if err := util.WriteFile(filepath.Join(path, "install.sh"), shContent); err != nil {
			return err
		}
	}

	return nil
}

// ApplyTemplate applies a server template to the instance
func ApplyTemplate(templateID, instancePath string) error {
	cfg := config.GetConfig()
	dataPath := filepath.Join(cfg.GetTemplatePath(templateID), "data")
	if !util.IsDir(dataPath) {
		return fmt.Errorf("template data directory not found: %s", dataPath)
	}
	return util.CopyDirectory(dataPath, instancePath)
}