package download

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"dex/backend/modloader"
	"dex/backend/utils"

	"github.com/wailsapp/wails/v3/pkg/application"
	"resty.dev/v3"
)

// DownloadService is a Wails service that provides version list APIs
// and server install orchestration for the download page.
type DownloadService struct {
	client *resty.Client
	cache  *VersionCache
	app    *application.App
}

// NewDownloadService creates a new DownloadService instance.
func NewDownloadService() *DownloadService {
	return &DownloadService{
		client: resty.New().
			SetHeader("User-Agent", "DeEarthX").
			SetTimeout(30 * time.Second).
			SetRetryCount(2),
		cache: NewVersionCache(5 * time.Minute),
	}
}

// SetApp injects the Wails application instance for event emission.
func SetApp(app *application.App) {
	// Store in a package-level variable so goroutines can access it
	globalApp = app
}

// globalApp holds the Wails application instance for event emission from goroutines.
var globalApp *application.App

// --- Result types for version list APIs ---

// McVersionEntry represents a single Minecraft version.
type McVersionEntry struct {
	ID   string `json:"id"`
	Type string `json:"type"`
}

// McVersionResult is the response for FetchMcVersions.
type McVersionResult struct {
	Versions []McVersionEntry `json:"versions"`
}

// ForgePromoEntry holds latest/recommended version info for a MC version.
type ForgePromoEntry struct {
	Latest      string `json:"latest,omitempty"`
	Recommended string `json:"recommended,omitempty"`
}

// ForgeVersionEntry represents a single Forge build version.
type ForgeVersionEntry struct {
	Version   string `json:"version"`
	Mcversion string `json:"mcversion"`
	Hash      string `json:"hash,omitempty"`
}

// NeoForgeVersionEntry represents a single NeoForge build version.
type NeoForgeVersionEntry struct {
	Version       string `json:"version"`
	Mcversion     string `json:"mcversion"`
	InstallerPath string `json:"installerPath"`
	Latest        bool   `json:"latest"`
}

// FabricVersionEntry represents a single Fabric loader version.
type FabricVersionEntry struct {
	Version string `json:"version"`
	Stable  bool   `json:"stable"`
}

// --- Wails-bound methods ---

// FetchMcVersions fetches the list of Minecraft versions from BMCLAPI or Mojang.
func (s *DownloadService) FetchMcVersions() (*McVersionResult, error) {
	// Check cache
	if cached, ok := s.cache.Get("minecraft-versions"); ok {
		if result, ok := cached.(*McVersionResult); ok {
			return result, nil
		}
	}

	// Determine URL based on mirror config
	url := "https://launchermeta.mojang.com/mc/game/version_manifest.json"
	if utils.GlobalConfig.GetConfigValue("mirror.bmclapi") == true {
		url = "https://bmclapi2.bangbang93.com/mc/game/version_manifest.json"
	}

	resp, err := s.client.R().Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch minecraft versions: %w", err)
	}
	if resp.StatusCode() >= 400 {
		return nil, fmt.Errorf("failed to fetch minecraft versions: HTTP %d", resp.StatusCode())
	}

	var data struct {
		Versions []struct {
			ID   string `json:"id"`
			Type string `json:"type"`
		} `json:"versions"`
	}

	if err := json.Unmarshal(resp.Bytes(), &data); err != nil {
		return nil, fmt.Errorf("failed to parse minecraft versions: %w", err)
	}

	result := &McVersionResult{
		Versions: make([]McVersionEntry, len(data.Versions)),
	}
	for i, v := range data.Versions {
		result.Versions[i] = McVersionEntry{ID: v.ID, Type: v.Type}
	}

	s.cache.Set("minecraft-versions", result)
	return result, nil
}

// FetchForgePromos fetches Forge latest/recommended promo badges from BMCLAPI.
func (s *DownloadService) FetchForgePromos() (map[string]ForgePromoEntry, error) {
	// Check cache
	if cached, ok := s.cache.Get("forge-promos"); ok {
		if result, ok := cached.(map[string]ForgePromoEntry); ok {
			return result, nil
		}
	}

	resp, err := s.client.R().Get("https://bmclapi2.bangbang93.com/forge/promos")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch forge promos: %w", err)
	}
	if resp.StatusCode() >= 400 {
		return nil, fmt.Errorf("failed to fetch forge promos: HTTP %d", resp.StatusCode())
	}

	var promos []struct {
		Name  string `json:"name"`
		Build struct {
			Mcversion string `json:"mcversion"`
			Version   string `json:"version"`
		} `json:"build"`
	}

	if err := json.Unmarshal(resp.Bytes(), &promos); err != nil {
		return nil, fmt.Errorf("failed to parse forge promos: %w", err)
	}

	result := make(map[string]ForgePromoEntry)
	for _, entry := range promos {
		if entry.Build.Mcversion == "" {
			continue
		}
		promo := result[entry.Build.Mcversion]
		if strings.HasSuffix(entry.Name, "-latest") {
			promo.Latest = entry.Build.Version
		} else if strings.HasSuffix(entry.Name, "-recommended") {
			promo.Recommended = entry.Build.Version
		}
		result[entry.Build.Mcversion] = promo
	}

	s.cache.Set("forge-promos", result)
	return result, nil
}

// FetchForgeVersions fetches Forge build versions for a given Minecraft version.
func (s *DownloadService) FetchForgeVersions(mcver string) ([]ForgeVersionEntry, error) {
	if mcver == "" {
		return nil, fmt.Errorf("mcver parameter is required")
	}

	cacheKey := "forge-versions:" + mcver
	if cached, ok := s.cache.Get(cacheKey); ok {
		if result, ok := cached.([]ForgeVersionEntry); ok {
			return result, nil
		}
	}

	url := fmt.Sprintf("https://bmclapi2.bangbang93.com/forge/minecraft/%s", mcver)
	resp, err := s.client.R().Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch forge versions: %w", err)
	}
	if resp.StatusCode() >= 400 {
		return nil, fmt.Errorf("failed to fetch forge versions: HTTP %d", resp.StatusCode())
	}

	var builds []struct {
		Version   string `json:"version"`
		Mcversion string `json:"mcversion"`
		Files     []struct {
			Format   string `json:"format"`
			Category string `json:"category"`
			Hash     string `json:"hash"`
		} `json:"files"`
	}

	if err := json.Unmarshal(resp.Bytes(), &builds); err != nil {
		return nil, fmt.Errorf("failed to parse forge versions: %w", err)
	}

	result := make([]ForgeVersionEntry, len(builds))
	for i, build := range builds {
		entry := ForgeVersionEntry{
			Version:   build.Version,
			Mcversion: build.Mcversion,
		}
		for _, file := range build.Files {
			if file.Category == "installer" && file.Format == "jar" {
				entry.Hash = file.Hash
				break
			}
		}
		result[i] = entry
	}

	s.cache.Set(cacheKey, result)
	return result, nil
}

// FetchNeoForgeVersions fetches NeoForge build versions for a given Minecraft version.
func (s *DownloadService) FetchNeoForgeVersions(mcver string) ([]NeoForgeVersionEntry, error) {
	if mcver == "" {
		return nil, fmt.Errorf("mcver parameter is required")
	}

	cacheKey := "neoforge-versions:" + mcver
	if cached, ok := s.cache.Get(cacheKey); ok {
		if result, ok := cached.([]NeoForgeVersionEntry); ok {
			return result, nil
		}
	}

	url := fmt.Sprintf("https://bmclapi2.bangbang93.com/neoforge/list/%s", mcver)
	resp, err := s.client.R().Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch neoforge versions: %w", err)
	}
	if resp.StatusCode() >= 400 {
		return nil, fmt.Errorf("failed to fetch neoforge versions: HTTP %d", resp.StatusCode())
	}

	var builds []struct {
		Version       string `json:"version"`
		Mcversion     string `json:"mcversion"`
		InstallerPath string `json:"installerPath"`
	}

	if err := json.Unmarshal(resp.Bytes(), &builds); err != nil {
		return nil, fmt.Errorf("failed to parse neoforge versions: %w", err)
	}

	result := make([]NeoForgeVersionEntry, len(builds))
	for i, build := range builds {
		result[i] = NeoForgeVersionEntry{
			Version:       build.Version,
			Mcversion:     build.Mcversion,
			InstallerPath: build.InstallerPath,
			Latest:        i == len(builds)-1, // last one is latest
		}
	}

	s.cache.Set(cacheKey, result)
	return result, nil
}

// FetchFabricVersions fetches Fabric loader versions for a given Minecraft version.
func (s *DownloadService) FetchFabricVersions(mcver string) ([]FabricVersionEntry, error) {
	if mcver == "" {
		return nil, fmt.Errorf("mcver parameter is required")
	}

	cacheKey := "fabric-versions:" + mcver
	if cached, ok := s.cache.Get(cacheKey); ok {
		if result, ok := cached.([]FabricVersionEntry); ok {
			return result, nil
		}
	}

	url := fmt.Sprintf("https://meta.fabricmc.net/v1/versions/loader/%s", mcver)
	resp, err := s.client.R().Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch fabric versions: %w", err)
	}
	if resp.StatusCode() >= 400 {
		return nil, fmt.Errorf("failed to fetch fabric versions: HTTP %d", resp.StatusCode())
	}

	var loaders []struct {
		Loader struct {
			Version string `json:"version"`
			Stable  bool   `json:"stable"`
		} `json:"loader"`
	}

	if err := json.Unmarshal(resp.Bytes(), &loaders); err != nil {
		return nil, fmt.Errorf("failed to parse fabric versions: %w", err)
	}

	result := make([]FabricVersionEntry, len(loaders))
	for i, l := range loaders {
		result[i] = FabricVersionEntry{
			Version: l.Loader.Version,
			Stable:  l.Loader.Stable,
		}
	}

	// Sort stable versions first
	sort.SliceStable(result, func(i, j int) bool {
		if result[i].Stable != result[j].Stable {
			return result[i].Stable // stable=true comes first
		}
		return false
	})

	s.cache.Set(cacheKey, result)
	return result, nil
}

// StartInstall begins an async server installation. Returns the install path immediately.
// Progress is reported via Wails events (server_install_start, server_install_step, etc.).
func (s *DownloadService) StartInstall(loader, mcVersion, loaderVersion string, autoInstall bool) (string, error) {
	if loader == "" || mcVersion == "" || loaderVersion == "" {
		return "", fmt.Errorf("missing required parameters: loader, mcVersion, loaderVersion")
	}

	name := loaderDisplayName(loader)
	timestamp := fmt.Sprintf("%d", time.Now().UnixMilli())[6:10] // same as TS: Date.now().toString().substring(6, 10)
	dirName := fmt.Sprintf("%s-%s-%s-%s", mcVersion, name, loaderVersion, timestamp)
	installPath := filepath.Join(modloader.GetAppDir(), "instance", dirName)

	// Create the install directory
	if err := os.MkdirAll(installPath, 0o755); err != nil {
		return "", fmt.Errorf("failed to create install directory: %w", err)
	}

	// Launch async install goroutine
	go performInstall(loader, mcVersion, loaderVersion, installPath, autoInstall)

	return installPath, nil
}

// --- Helper functions ---

// loaderDisplayName returns the display name for a loader type.
func loaderDisplayName(loader string) string {
	switch loader {
	case "forge":
		return "Forge"
	case "neoforge":
		return "NeoForge"
	case "fabric", "fabric-loader":
		return "Fabric"
	default:
		return loader
	}
}

// performInstall runs the actual installation in a goroutine, emitting Wails events for progress.
func performInstall(loader, mcVersion, loaderVersion, installPath string, autoInstall bool) {
	startTime := time.Now()

	// Emit start event
	emitEvent("server_install_start", ServerInstallStartEvent{
		ModpackName:      "Server Install",
		MinecraftVersion: mcVersion,
		LoaderType:       loader,
		LoaderVersion:    loaderVersion,
	})

	if autoInstall {
		// Step 1: Install Minecraft server
		emitEvent("server_install_step", ServerInstallStepEvent{
			Step:       "安装 Minecraft 服务端",
			StepIndex:  1,
			TotalSteps: 2,
		})

		minecraft := modloader.NewMinecraft(loader, mcVersion, loaderVersion, installPath)
		if err := minecraft.Setup(); err != nil {
			emitInstallError(err.Error())
			return
		}

		// Step 2: Install mod loader
		loaderName := loaderDisplayName(loader)
		emitEvent("server_install_step", ServerInstallStepEvent{
			Step:       fmt.Sprintf("安装 %s 加载器", loaderName),
			StepIndex:  2,
			TotalSteps: 2,
		})

		ml := modloader.NewModloader(loader, mcVersion, loaderVersion, installPath)
		if err := ml.Setup(); err != nil {
			emitInstallError(err.Error())
			return
		}
	} else {
		// Step 1: Download installer only
		emitEvent("server_install_step", ServerInstallStepEvent{
			Step:       "下载安装器",
			StepIndex:  1,
			TotalSteps: 2,
		})

		ml := modloader.NewModloader(loader, mcVersion, loaderVersion, installPath)
		if err := ml.Installer(); err != nil {
			emitInstallError(err.Error())
			return
		}

		// Step 2: Generate install scripts
		emitEvent("server_install_step", ServerInstallStepEvent{
			Step:       "生成安装脚本",
			StepIndex:  2,
			TotalSteps: 2,
		})

		if err := generateInstallScripts(loader, mcVersion, loaderVersion, installPath); err != nil {
			emitInstallError(err.Error())
			return
		}
	}

	duration := time.Since(startTime).Milliseconds()
	emitEvent("server_install_complete", ServerInstallCompleteEvent{
		InstallPath: installPath,
		Duration:    duration,
	})
}

// generateInstallScripts writes .bat/.sh scripts for manual server installation.
func generateInstallScripts(loader, mcVersion, loaderVersion, installPath string) error {
	javaCmd := "java"
	if v := utils.GlobalConfig.GetConfigValue("javaPath"); v != nil {
		if s, ok := v.(string); ok && s != "" {
			javaCmd = s
		}
	}

	if loader == "forge" || loader == "neoforge" {
		installerJar := fmt.Sprintf("forge-%s-%s-installer.jar", mcVersion, loaderVersion)
		basicCmd := fmt.Sprintf("%s -jar %s --installServer", javaCmd, installerJar)
		chinaCmd := fmt.Sprintf("%s -jar %s --installServer --mirror https://bmclapi2.bangbang93.com/maven/", javaCmd, installerJar)

		// install_forge.bat
		installForgeBat := fmt.Sprintf("@echo off\n%s\necho Install Successfully, Press any key to exit!\npause\n", basicCmd)
		if err := os.WriteFile(filepath.Join(installPath, "install_forge.bat"), []byte(installForgeBat), 0o644); err != nil {
			return err
		}

		// install_forge.sh
		installForgeSh := fmt.Sprintf("#!/bin/bash\n%s\n", basicCmd)
		if err := os.WriteFile(filepath.Join(installPath, "install_forge.sh"), []byte(installForgeSh), 0o644); err != nil {
			return err
		}

		// install_forge_china.bat
		installForgeChinaBat := fmt.Sprintf("@echo off\n%s\necho Install Successfully, Press any key to exit!\npause\n", chinaCmd)
		if err := os.WriteFile(filepath.Join(installPath, "install_forge_china.bat"), []byte(installForgeChinaBat), 0o644); err != nil {
			return err
		}

		// install_forge_china.sh
		installForgeChinaSh := fmt.Sprintf("#!/bin/bash\n%s\n", chinaCmd)
		if err := os.WriteFile(filepath.Join(installPath, "install_forge_china.sh"), []byte(installForgeChinaSh), 0o644); err != nil {
			return err
		}

		// For MC < 1.16.5, also write run.sh
		if utils.VersionCompare(mcVersion, "1.16.5") < 0 {
			runSh := fmt.Sprintf("#!/bin/bash\n%s -jar forge-%s-%s.jar\n", javaCmd, mcVersion, loaderVersion)
			if err := os.WriteFile(filepath.Join(installPath, "run.sh"), []byte(runSh), 0o644); err != nil {
				return err
			}
		}
	} else if loader == "fabric" || loader == "fabric-loader" {
		cmd := fmt.Sprintf("%s -jar fabric-installer.jar server -dir . -mcversion %s -loader %s -downloadMinecraft", javaCmd, mcVersion, loaderVersion)

		// install.bat
		installBat := fmt.Sprintf("@echo off\n%s\necho Install Successfully, Press any key to exit!\npause\n", cmd)
		if err := os.WriteFile(filepath.Join(installPath, "install.bat"), []byte(installBat), 0o644); err != nil {
			return err
		}

		// install.sh
		installSh := fmt.Sprintf("#!/bin/bash\n%s\n", cmd)
		if err := os.WriteFile(filepath.Join(installPath, "install.sh"), []byte(installSh), 0o644); err != nil {
			return err
		}

		// run.bat
		runBat := fmt.Sprintf("@echo off\n%s -jar fabric-server-launch.jar\npause\n", javaCmd)
		if err := os.WriteFile(filepath.Join(installPath, "run.bat"), []byte(runBat), 0o644); err != nil {
			return err
		}

		// run.sh
		runSh := fmt.Sprintf("#!/bin/bash\n%s -jar fabric-server-launch.jar\n", javaCmd)
		if err := os.WriteFile(filepath.Join(installPath, "run.sh"), []byte(runSh), 0o644); err != nil {
			return err
		}
	}

	return nil
}

// emitEvent emits a Wails event if the app instance is available.
func emitEvent(name string, data any) {
	if globalApp != nil {
		globalApp.Event.Emit(name, data)
	}
}

// emitInstallError emits a server_install_error event.
func emitInstallError(errMsg string) {
	emitEvent("server_install_error", ServerInstallErrorEvent{
		Error: errMsg,
	})
}
