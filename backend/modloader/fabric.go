package modloader

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"dex/backend/utils"

	"resty.dev/v3"
)

func NewFabric(mcv, mlv, path string) XModloader {
	return &Fabric{
		minecraft:     mcv,
		loaderVersion: mlv,
		path:          path,
		client: resty.New().
			SetBaseURL("https://bmclapi2.bangbang93.com/").
			SetHeader("User-Agent", "DeEarthX"),
	}
}

type Fabric struct {
	minecraft     string
	loaderVersion string
	path          string
	client        *resty.Client
}

func (f *Fabric) Setup() error {
	// Step 1: Download fabric-installer.jar
	if err := f.Installer(); err != nil {
		return fmt.Errorf("fabric installer download failed: %w", err)
	}

	// Step 2: Download libraries (if BMCLAPI mirror is enabled)
	bmclapi := utils.GlobalConfig.GetConfigValue("mirror.bmclapi")
	if bmclapi == true {
		if err := f.libraries(); err != nil {
			return fmt.Errorf("fabric libraries download failed: %w", err)
		}
	}

	// Step 3: Run fabric installer
	if err := f.Install(); err != nil {
		return fmt.Errorf("fabric install failed: %w", err)
	}

	// Step 4: Write shell scripts
	if err := f.wshell(); err != nil {
		return fmt.Errorf("fabric shell script generation failed: %w", err)
	}

	return nil
}

func (f *Fabric) Installer() error {
	// Fetch latest stable installer URL from fabric-meta
	resp, err := f.client.R().Get("fabric-meta/v2/versions/installer")
	if err != nil {
		return fmt.Errorf("failed to fetch fabric installer versions: %w", err)
	}

	var installers []struct {
		URL    string `json:"url"`
		Stable bool   `json:"stable"`
	}

	if err := parseJSON(resp.Bytes(), &installers); err != nil {
		return fmt.Errorf("failed to parse fabric installer versions: %w", err)
	}

	downloadURL := ""
	for _, inst := range installers {
		if inst.Stable {
			downloadURL = inst.URL
			break
		}
	}

	if downloadURL == "" {
		return fmt.Errorf("no stable fabric installer found")
	}

	filePath := filepath.Join(f.path, "fabric-installer.jar")
	// Use chunked download for the installer jar
	if err := utils.NewDownloadClient().ChunkedDownload(downloadURL, filePath); err != nil {
		return fmt.Errorf("failed to download fabric installer: %w", err)
	}

	return nil
}

func (f *Fabric) Install() error {
	javaCmd := getJavaCmd()
	cmd := fmt.Sprintf("%s -jar fabric-installer.jar server -dir . -mcversion %s -loader %s", javaCmd, f.minecraft, f.loaderVersion)
	if err := utils.ExecPromise(cmd, f.path); err != nil {
		fmt.Printf("fabric install error: %v\n", err)
	}
	return nil
}

func (f *Fabric) libraries() error {
	// Fetch server profile JSON
	url := fmt.Sprintf("fabric-meta/v2/versions/loader/%s/%s/server/json", f.minecraft, f.loaderVersion)
	resp, err := f.client.R().Get(url)
	if err != nil {
		return fmt.Errorf("failed to fetch fabric server json: %w", err)
	}

	var serverJSON struct {
		Libraries []struct {
			Name string `json:"name"`
		} `json:"libraries"`
	}

	if err := parseJSON(resp.Bytes(), &serverJSON); err != nil {
		return fmt.Errorf("failed to parse fabric server json: %w", err)
	}

	var downloadItems []utils.DownloadOption
	for _, lib := range serverJSON.Libraries {
		libPath := MTP(lib.Name)
		downloadItems = append(downloadItems, utils.DownloadOption{
			URL:      "https://bmclapi2.bangbang93.com/maven/" + libPath,
			FilePath: filepath.Join(f.path, "libraries", libPath),
		})
	}

	if err := utils.FastDownload(downloadItems); err != nil {
		return err
	}

	// Verify downloaded files
	bmclapi := utils.GlobalConfig.GetConfigValue("mirror.bmclapi")
	if bmclapi == true {
		verifiedCount := 0
		for _, item := range downloadItems {
			if _, err := os.Stat(item.FilePath); err == nil {
				verifiedCount++
			}
		}
		fmt.Printf("Fabric library verification: %d/%d files present\n", verifiedCount, len(downloadItems))
	}

	return nil
}

func (f *Fabric) wshell() error {
	javaCmd := getJavaCmd()
	cmd := fmt.Sprintf("%s -jar fabric-server-launch.jar", javaCmd)

	batContent := fmt.Sprintf("@echo off\n%s", cmd)
	shContent := fmt.Sprintf("#!/bin/bash\n%s", cmd)

	if err := os.WriteFile(filepath.Join(f.path, "run.bat"), []byte(batContent), 0o644); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(f.path, "run.sh"), []byte(shContent), 0o644)
}

// MTP converts a Maven coordinate string to a file system path.
// e.g., "net.fabricmc:fabric-loader:0.15.0" -> "net/fabricmc/fabric-loader/0.15.0/fabric-loader-0.15.0.jar"
func MTP(coord string) string {
	mjp := strings.Trim(coord, "[]")
	atParts := strings.SplitN(mjp, "@", 2)
	originalName := atParts[0]
	mappingType := "jar"
	if len(atParts) > 1 && atParts[1] != "" {
		mappingType = atParts[1]
	}

	x := strings.Split(originalName, ":")
	group := strings.ReplaceAll(x[0], ".", "/")
	artifact := x[1]
	version := x[2]

	if len(x) > 3 {
		classifier := x[3]
		return fmt.Sprintf("%s/%s/%s/%s-%s-%s.%s", group, artifact, version, artifact, version, classifier, mappingType)
	}
	return fmt.Sprintf("%s/%s/%s/%s-%s.%s", group, artifact, version, artifact, version, mappingType)
}
