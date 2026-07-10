package modloader

import (
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
	totalSteps := 2
	if template != "" && template != "0" {
		totalSteps = 3
	}

	util.Logger.Info("Starting server installation: " + ml + " " + mcv + "-" + mlv)

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
	if template == "" || template == "0" {
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
	}

	// Step 3: Apply template if specified
	if template != "" && template != "0" {
		if progress != nil {
			progress("Applying Template: "+template, 3, totalSteps)
		}
		// Template application will be handled separately
	}

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
		cmd = "java -jar fabric-installer.jar server -dir . -mcversion " + mcv + " -loader " + mlv + " -downloadMinecraft"
	}

	if cmd != "" {
		batContent := "@echo off\n" + cmd + "\necho Install Successfully,Enter Some Key to Exit!\npause\n"
		shContent := "#!/bin/bash\n" + cmd + "\n"

		if err := util.WriteFile(path+"/install.bat", batContent); err != nil {
			return err
		}
		if err := util.WriteFile(path+"/install.sh", shContent); err != nil {
			return err
		}
	}

	return nil
}

// ApplyTemplate applies a server template to the instance
func ApplyTemplate(templateID, instancePath string) error {
	cfg := config.GetConfig()
	templatePath := cfg.GetTemplatePath(templateID)
	dataPath := templatePath + "/data"

	return util.CopyDirectory(dataPath, instancePath)
}