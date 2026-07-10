package modloader

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"

	"resty.dev/v3"

	"deearthx/core/config"
	"deearthx/core/download"
	"deearthx/core/maven"
	"deearthx/core/util"
)

// Fabric handles Fabric mod loader installation
type Fabric struct {
	minecraft     string
	loaderVersion string
	path          string
	client        *resty.Client
}

// NewFabric creates a new Fabric handler
func NewFabric(minecraft, loaderVersion, path string) *Fabric {
	return &Fabric{
		minecraft:     minecraft,
		loaderVersion: loaderVersion,
		path:          path,
		client:        resty.New(),
	}
}

// Setup installs Fabric
func (f *Fabric) Setup(progress ProgressCallback) error {
	// Download installer
	if err := f.downloadInstaller(); err != nil {
		return err
	}

	// Download libraries if BMCLAPI enabled
	cfg := config.GetConfig()
	if cfg.Mirror.BMCLAPI {
		if err := f.downloadLibraries(); err != nil {
			util.Logger.Warn("Failed to download Fabric libraries: " + err.Error())
		}
	}

	// Run installer
	if err := f.Install(); err != nil {
		return err
	}

	// Create run scripts
	return f.createRunScripts()
}

// Installer downloads the Fabric installer
func (f *Fabric) Installer() error {
	return f.downloadInstaller()
}

// Install runs the Fabric installer
func (f *Fabric) Install() error {
	cfg := config.GetConfig()
	javaCmd := "java"
	if cfg.JavaPath != "" {
		javaCmd = cfg.JavaPath
	}

	cmd := exec.Command(javaCmd, "-jar", "fabric-installer.jar", "server", "-dir", ".", "-mcversion", f.minecraft, "-loader", f.loaderVersion)
	cmd.Dir = f.path

	output, err := cmd.CombinedOutput()
	if err != nil {
		util.Logger.Error("Fabric install failed: " + string(output))
		return err
	}

	util.Logger.Info("Fabric installation complete")
	return nil
}

func (f *Fabric) downloadInstaller() error {
	// Get latest installer URL
	installerURL := download.GetBMCLAPIPrefix() + "/fabric-meta/v2/versions/installer"

	resp, err := f.client.R().SetHeader("User-Agent", "DeEarthX").Get(installerURL)
	if err != nil {
		return err
	}

	var installers []struct {
		URL    string `json:"url"`
		Stable bool   `json:"stable"`
	}

	if err := json.Unmarshal(resp.Bytes(), &installers); err != nil {
		return err
	}

	var downloadURL string
	for _, installer := range installers {
		if installer.Stable {
			downloadURL = installer.URL
			break
		}
	}

	if downloadURL == "" && len(installers) > 0 {
		downloadURL = installers[0].URL
	}

	filePath := filepath.Join(f.path, "fabric-installer.jar")

	dl := download.NewDownloadClient()
	return dl.DownloadFile(download.DownloadOptions{
		URL:        downloadURL,
		FilePath:   filePath,
		UseChunked: true,
	}, nil)
}

func (f *Fabric) downloadLibraries() error {
	// Get server JSON from fabric-meta
	url := download.GetBMCLAPIPrefix() + "/fabric-meta/v2/versions/loader/" + f.minecraft + "/" + f.loaderVersion + "/server/json"

	resp, err := f.client.R().SetHeader("User-Agent", "DeEarthX").Get(url)
	if err != nil {
		return err
	}

	var serverInfo struct {
		Libraries []struct {
			Name string `json:"name"`
		} `json:"libraries"`
	}

	if err := json.Unmarshal(resp.Bytes(), &serverInfo); err != nil {
		return err
	}

	downloadList := []download.DownloadOptions{}
	for _, lib := range serverInfo.Libraries {
		path := f.mtp(lib.Name)
		libURL := download.GetBMCLAPIPrefix() + "/maven/" + path
		libPath := filepath.Join(f.path, "libraries", path)

		downloadList = append(downloadList, download.DownloadOptions{
			URL:        libURL,
			FilePath:   libPath,
			UseChunked: true,
		})
	}

	if len(downloadList) > 0 {
		dl := download.NewDownloadClient()
		return dl.BatchDownload(downloadList, 32, nil)
	}

	return nil
}

func (f *Fabric) createRunScripts() error {
	cfg := config.GetConfig()
	javaCmd := "java"
	if cfg.JavaPath != "" {
		javaCmd = cfg.JavaPath
	}

	cmd := javaCmd + " -jar fabric-server-launch.jar"

	batContent := "@echo off\n" + cmd + "\n"
	shContent := "#!/bin/bash\n" + cmd + "\n"

	os.WriteFile(filepath.Join(f.path, "run.bat"), []byte(batContent), 0644)
	os.WriteFile(filepath.Join(f.path, "run.sh"), []byte(shContent), 0644)

	return nil
}

// mtp converts Maven coordinate to path (Fabric style)
func (f *Fabric) mtp(coord string) string {
	return maven.MTP(coord)
}