package modloader

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"resty.dev/v3"

	"deearthx/core/config"
	"deearthx/core/download"
	"deearthx/core/java"
	"deearthx/core/maven"
	"deearthx/core/util"
	"deearthx/core/ziputil"
)

// Forge handles Forge mod loader installation
type Forge struct {
	minecraft     string
	loaderVersion string
	path          string
	client        *resty.Client
}

// NewForge creates a new Forge handler
func NewForge(minecraft, loaderVersion, path string) *Forge {
	return &Forge{
		minecraft:     minecraft,
		loaderVersion: loaderVersion,
		path:          path,
		client:        resty.New(),
	}
}

// Setup installs Forge
func (f *Forge) Setup(progress ProgressCallback) error {
	// Download installer
	if err := f.downloadInstaller(); err != nil {
		return err
	}

	// Download libraries (if BMCLAPI enabled)
	cfg := config.GetConfig()
	if cfg.Mirror.BMCLAPI && java.VersionCompare(f.minecraft, "1.10") > 0 {
		if err := f.downloadLibraries(); err != nil {
			util.Logger.Warn("Failed to download libraries: " + err.Error())
		}
	}

	// Run installer
	if err := f.Install(); err != nil {
		return err
	}

	// Create run scripts for older versions
	if java.VersionCompare(f.minecraft, "1.18.0") < 0 {
		return f.createRunScripts()
	}

	return nil
}

// Installer downloads the Forge installer
func (f *Forge) Installer() error {
	return f.downloadInstaller()
}

// Install runs the Forge installer
func (f *Forge) Install() error {
	cfg := config.GetConfig()
	javaCmd := "java"
	if cfg.JavaPath != "" {
		javaCmd = cfg.JavaPath
	}

	cmd := exec.Command(javaCmd, "-jar", "forge-"+f.minecraft+"-"+f.loaderVersion+"-installer.jar", "--installServer")
	cmd.Dir = f.path

	if cfg.Mirror.BMCLAPI && java.VersionCompare(f.minecraft, "1.10") > 0 {
		cmd.Args = append(cmd.Args, "--mirror", "https://bmclapi2.bangbang93.com/maven/")
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		util.Logger.Error("Forge install failed: " + string(output))
		return fmt.Errorf("forge install failed: %w", err)
	}

	util.Logger.Info("Forge installation complete")
	return nil
}

func (f *Forge) downloadInstaller() error {
	cfg := config.GetConfig()

	var url string
	var expectedHash string

	if cfg.Mirror.BMCLAPI {
		// Get hash from BMCLAPI
		forgeInfoURL := download.GetBMCLAPIPrefix() + "/forge/minecraft/" + f.minecraft
		resp, err := f.client.R().SetHeader("User-Agent", "DeEarthX").Get(forgeInfoURL)
		if err == nil && resp.StatusCode() == 200 {
			var builds []struct {
				Version string `json:"version"`
				Files   []struct {
					Format   string `json:"format"`
					Category string `json:"category"`
					Hash     string `json:"hash"`
				} `json:"files"`
			}
			json.Unmarshal(resp.Bytes(), &builds)

			for _, build := range builds {
				if build.Version == f.loaderVersion {
					for _, file := range build.Files {
						if file.Category == "installer" && file.Format == "jar" {
							expectedHash = file.Hash
							break
						}
					}
				}
			}
		}

		url = download.GetBMCLAPIPrefix() + "/forge/download?mcversion=" + f.minecraft + "&version=" + f.loaderVersion + "&category=installer&format=jar"
		if java.VersionCompare(f.minecraft, "1.10") <= 0 {
			url += "&branch=" + f.minecraft
		}
	} else {
		url = "https://maven.minecraftforge.net/net/minecraftforge/forge/" + f.minecraft + "-" + f.loaderVersion + "/forge-" + f.minecraft + "-" + f.loaderVersion + "-installer.jar"
	}

	filePath := filepath.Join(f.path, "forge-"+f.minecraft+"-"+f.loaderVersion+"-installer.jar")

	dl := download.NewDownloadClient()
	err := dl.DownloadFile(download.DownloadOptions{
		URL:          url,
		FilePath:     filePath,
		ExpectedHash: expectedHash,
		UseChunked:   true,
	}, nil)

	if err != nil {
		return err
	}

	util.Logger.Info("Forge installer downloaded")
	return nil
}

func (f *Forge) downloadLibraries() error {
	installerPath := filepath.Join(f.path, "forge-"+f.minecraft+"-"+f.loaderVersion+"-installer.jar")

	data, err := os.ReadFile(installerPath)
	if err != nil {
		return err
	}

	entries, err := ziputil.ReadZip(data)
	if err != nil {
		return err
	}

	downloadList := []download.DownloadOptions{}

	for _, entry := range entries {
		if entry.Name == "version.json" || entry.Name == "install_profile.json" {
			var jsonData map[string]interface{}
			json.Unmarshal(entry.Data, &jsonData)

			if libs, ok := jsonData["libraries"].([]interface{}); ok {
				for _, lib := range libs {
					libMap, ok := lib.(map[string]interface{})
					if !ok {
						continue
					}

					downloads, ok := libMap["downloads"].(map[string]interface{})
					if !ok {
						continue
					}

					artifact, ok := downloads["artifact"].(map[string]interface{})
					if !ok {
						continue
					}

					libPath, ok := artifact["path"].(string)
					if !ok {
						continue
					}

					libURL := download.GetBMCLAPIPrefix() + "/maven/" + libPath
					libFilePath := filepath.Join(f.path, "libraries", libPath)

					downloadList = append(downloadList, download.DownloadOptions{
						URL:        libURL,
						FilePath:   libFilePath,
						UseChunked: true,
					})
				}
			}
		}

		// Handle mappings for older versions
		if entry.Name == "install_profile.json" && java.VersionCompare(f.loaderVersion, "26") < 0 {
			// Parse install_profile.json for mappings
			// This is complex and requires additional parsing
		}
	}

	if len(downloadList) > 0 {
		dl := download.NewDownloadClient()
		return dl.BatchDownload(downloadList, 32, nil)
	}

	return nil
}

func (f *Forge) createRunScripts() error {
	cfg := config.GetConfig()
	javaCmd := "java"
	if cfg.JavaPath != "" {
		javaCmd = cfg.JavaPath
	}

	var cmd string
	if java.VersionCompare(f.minecraft, "1.10.0") < 0 {
		cmd = javaCmd + " -jar forge-" + f.minecraft + "-" + f.loaderVersion + "-" + f.minecraft + "-universal.jar"
	} else {
		cmd = javaCmd + " -jar forge-" + f.minecraft + "-" + f.loaderVersion + ".jar"
	}

	batContent := "@echo off\n" + cmd + "\n"
	shContent := "#!/bin/bash\n" + cmd + "\n"

	os.WriteFile(filepath.Join(f.path, "run.bat"), []byte(batContent), 0644)
	os.WriteFile(filepath.Join(f.path, "run.sh"), []byte(shContent), 0644)

	return nil
}

// MTP converts Maven coordinate to path (Forge style)
func (f *Forge) MTP(coord string) string {
	return maven.MTP(coord)
}