package modloader

import (
	"log/slog"
	"archive/zip"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"dex/backend/utils"

	"resty.dev/v3"
)

func NewForge(mcv, mlv, path string) *Forge {
	f := &Forge{
		minecraft:     mcv,
		loaderVersion: mlv,
		path:          path,
	}

	bmclapi := utils.GlobalConfig.GetConfigValue("mirror.bmclapi")
	baseURL := "http://maven.minecraftforge.net/"
	if bmclapi == true {
		baseURL = "https://bmclapi2.bangbang93.com/"
	}

	f.client = resty.New().
		SetBaseURL(baseURL).
		SetHeader("User-Agent", "DeEarthX")

	return f
}

type Forge struct {
	minecraft     string
	loaderVersion string
	path          string
	client        *resty.Client
}

func (f *Forge) Setup() error {
	// Step 1: Download installer
	if err := f.Installer(); err != nil {
		return fmt.Errorf("forge installer download failed: %w", err)
	}

	// Step 2: Download libraries (if BMCLAPI mirror enabled and MC > 1.10)
	bmclapi := utils.GlobalConfig.GetConfigValue("mirror.bmclapi")
	if bmclapi == true && utils.VersionCompare(f.minecraft, "1.10") == 1 {
		if err := f.Library(); err != nil {
			return fmt.Errorf("forge library download failed: %w", err)
		}
	}

	// Step 3: Run installer
	if err := f.Install(); err != nil {
		return fmt.Errorf("forge install failed: %w", err)
	}

	// Step 4: Write shell scripts for MC < 1.18
	if utils.VersionCompare(f.minecraft, "1.18.0") == -1 {
		if err := f.wshell(); err != nil {
			return fmt.Errorf("forge shell script generation failed: %w", err)
		}
	}

	return nil
}

func (f *Forge) Installer() error {
	bmclapi := utils.GlobalConfig.GetConfigValue("mirror.bmclapi")

	relURL := fmt.Sprintf("forge/download?mcversion=%s&version=%s&category=installer&format=jar", f.minecraft, f.loaderVersion)
	if utils.VersionCompare(f.minecraft, "1.10") != 1 {
		relURL += "&branch=" + f.minecraft
	}

	var expectedHash string

	if bmclapi == true {
		// Try to get hash from BMCLAPI forge info
		forgeInfoURL := fmt.Sprintf("forge/minecraft/%s", f.minecraft)
		resp, err := f.client.R().Get(forgeInfoURL)
		if err == nil && resp.StatusCode() < 400 {
			var forgeBuilds []ForgeBuild
			if err := parseJSON(resp.Bytes(), &forgeBuilds); err == nil {
				for _, build := range forgeBuilds {
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
		}
	} else {
		// Official Maven URL
		relURL = fmt.Sprintf("net/minecraftforge/forge/%s-%s/forge-%s-%s-installer.jar",
			f.minecraft, f.loaderVersion, f.minecraft, f.loaderVersion)
	}

	// Build full URL for chunked download
	baseURL := f.client.BaseURL()
	fullURL := baseURL + relURL

	filePath := filepath.Join(f.path, fmt.Sprintf("forge-%s-%s-installer.jar", f.minecraft, f.loaderVersion))
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		return err
	}

	// Use chunked download for the installer jar
	downloadClient := utils.NewDownloadClient()
	if expectedHash != "" {
		if err := downloadClient.ChunkedDownload(fullURL, filePath, expectedHash); err != nil {
			// Hash verification failed, retry once
			slog.Warn("Forge installer hash verification failed, deleting and retrying")
			os.Remove(filePath)

			if err := downloadClient.ChunkedDownload(fullURL, filePath, expectedHash); err != nil {
				return fmt.Errorf("forge installer hash verification failed after retry: %w", err)
			}
		}
	} else {
		if err := downloadClient.ChunkedDownload(fullURL, filePath); err != nil {
			return fmt.Errorf("failed to download forge installer: %w", err)
		}
	}

	return nil
}

func (f *Forge) Library() error {
	var downloadItems []utils.DownloadOption

	installerPath := filepath.Join(f.path, fmt.Sprintf("forge-%s-%s-installer.jar", f.minecraft, f.loaderVersion))
	r, err := zip.OpenReader(installerPath)
	if err != nil {
		return fmt.Errorf("failed to open forge installer jar: %w", err)
	}
	defer r.Close()

	for _, file := range r.File {
		if file.Name == "version.json" || file.Name == "install_profile.json" {
			data, err := readZipFile(file)
			if err != nil {
				continue
			}

			var profile struct {
				Libraries []struct {
					Downloads struct {
						Artifact struct {
							Path string `json:"path"`
						} `json:"artifact"`
					} `json:"downloads"`
				} `json:"libraries"`
				Data struct {
					MOJMAPS struct {
						Server string `json:"server"`
					} `json:"MOJMAPS"`
					MAPPINGS struct {
						Server string `json:"server"`
					} `json:"MAPPINGS"`
				} `json:"data"`
			}

			if err := parseJSON(data, &profile); err != nil {
				continue
			}

			// Add library downloads
			for _, lib := range profile.Libraries {
				if lib.Downloads.Artifact.Path != "" {
					libPath := lib.Downloads.Artifact.Path
					downloadItems = append(downloadItems, utils.DownloadOption{
						URL:      "https://bmclapi2.bangbang93.com/maven/" + libPath,
						FilePath: filepath.Join(f.path, "libraries", libPath),
					})
				}
			}

			// Handle install_profile.json specific logic
			if file.Name == "install_profile.json" {
				// NeoForge 26.x+ doesn't need mappings
				if utils.VersionCompare(f.loaderVersion, "26") >= 0 {
					continue
				}

				// MC >= 1.18: download MOJMAPS
				if utils.VersionCompare(f.minecraft, "1.18") >= 0 && profile.Data.MOJMAPS.Server != "" {
					mojPath := MTP(profile.Data.MOJMAPS.Server)

					// Fetch version JSON to get server_mappings URL
					resp, err := f.client.R().Get("version/" + f.minecraft + "/json")
					if err == nil && resp.StatusCode() < 400 {
						var versionJSON struct {
							Downloads struct {
								ServerMappings struct {
									URL string `json:"url"`
								} `json:"server_mappings"`
							} `json:"downloads"`
						}
						if err := parseJSON(resp.Bytes(), &versionJSON); err == nil {
							parsedURL, _ := url.Parse(versionJSON.Downloads.ServerMappings.URL)
							if parsedURL != nil {
								downloadItems = append(downloadItems, utils.DownloadOption{
									URL:      "https://bmclapi2.bangbang93.com/" + strings.TrimPrefix(parsedURL.Path, "/"),
									FilePath: filepath.Join(f.path, "libraries", mojPath),
								})
							}
						}
					}
				}

				// MC > 1.12.2: download MCP Mappings
				if utils.VersionCompare(f.minecraft, "1.12.2") == 1 && profile.Data.MAPPINGS.Server != "" {
					mappingPath := MTP(strings.Replace(profile.Data.MAPPINGS.Server, ":mappings@txt", "@zip", 1))
					downloadItems = append(downloadItems, utils.DownloadOption{
						URL:      "https://bmclapi2.bangbang93.com/maven/" + mappingPath,
						FilePath: filepath.Join(f.path, "libraries", mappingPath),
					})
				}
			}
		}
	}

	// Deduplicate download items
	downloadItems = dedupDownloadItems(downloadItems)

	return utils.FastDownload(downloadItems)
}

func (f *Forge) Install() error {
	javaCmd := getJavaCmd()
	cmd := fmt.Sprintf("%s -jar forge-%s-%s-installer.jar --installServer", javaCmd, f.minecraft, f.loaderVersion)

	bmclapi := utils.GlobalConfig.GetConfigValue("mirror.bmclapi")
	if bmclapi == true && utils.VersionCompare(f.minecraft, "1.10") == 1 {
		cmd += " --mirror https://bmclapi2.bangbang93.com/maven/"
	}

	if err := utils.ExecPromise(cmd, f.path); err != nil {
		return fmt.Errorf("forge install failed: %w", err)
	}

	return nil
}

func (f *Forge) wshell() error {
	javaCmd := getJavaCmd()
	cmd := fmt.Sprintf("%s -jar forge-%s-%s.jar", javaCmd, f.minecraft, f.loaderVersion)
	if utils.VersionCompare(f.minecraft, "1.10.0") == -1 {
		cmd = fmt.Sprintf("%s -jar forge-%s-%s-%s-universal.jar", javaCmd, f.minecraft, f.loaderVersion, f.minecraft)
	}

	batContent := fmt.Sprintf("@echo off\n%s", cmd)
	shContent := fmt.Sprintf("#!/bin/bash\n%s", cmd)

	if err := os.WriteFile(filepath.Join(f.path, "run.bat"), []byte(batContent), 0o644); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(f.path, "run.sh"), []byte(shContent), 0o644)
}

// ForgeBuild represents a Forge build from BMCLAPI.
type ForgeBuild struct {
	Version string      `json:"version"`
	Files   []ForgeFile `json:"files"`
}

// ForgeFile represents a file within a Forge build.
type ForgeFile struct {
	Format   string `json:"format"`
	Category string `json:"category"`
	Hash     string `json:"hash"`
}

// dedupDownloadItems removes duplicate download items by URL.
func dedupDownloadItems(items []utils.DownloadOption) []utils.DownloadOption {
	seen := make(map[string]bool)
	var result []utils.DownloadOption
	for _, item := range items {
		if !seen[item.URL] {
			seen[item.URL] = true
			result = append(result, item)
		}
	}
	return result
}
