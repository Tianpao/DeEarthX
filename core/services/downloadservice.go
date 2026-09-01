package services

import (
	"encoding/json"
	"fmt"
	"path/filepath"

	"resty.dev/v3"

	"deearthx/core/config"
	"deearthx/core/download"
	"deearthx/core/dex"
	"deearthx/core/modloader"
	"deearthx/core/util"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// DownloadService handles version listing and server installation
type DownloadService struct {
	client *resty.Client
}

// NewDownloadService creates a new DownloadService
func NewDownloadService() *DownloadService {
	return &DownloadService{
		client: resty.New().SetHeader("User-Agent", "DeEarthX"),
	}
}

// MinecraftVersion represents a Minecraft version
type MinecraftVersion struct {
	ID   string `json:"id"`
	Type string `json:"type"`
}

// GetMinecraftVersions returns available Minecraft versions
func (s *DownloadService) GetMinecraftVersions() ([]MinecraftVersion, error) {
	url := download.GetBMCLAPIMetaPrefix() + "/mc/game/version_manifest_v2.json"
	resp, err := s.client.R().Get(url)
	if err != nil {
		return nil, err
	}

	var result struct {
		Versions []MinecraftVersion `json:"versions"`
	}
	if err := json.Unmarshal(resp.Bytes(), &result); err != nil {
		util.Logger.Warn("Failed to parse Minecraft versions response", "error", err.Error())
		return nil, nil
	}

	return result.Versions, nil
}

// ForgeVersion represents a Forge version
type ForgeVersion struct {
	Version   string `json:"version"`
	McVersion string `json:"mcversion"`
}

// GetForgeVersions returns Forge versions for a MC version
func (s *DownloadService) GetForgeVersions(mcVersion string) ([]ForgeVersion, error) {
	url := download.GetBMCLAPIPrefix() + "/forge/minecraft/" + mcVersion
	resp, err := s.client.R().Get(url)
	if err != nil {
		return nil, err
	}

	var result []struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(resp.Bytes(), &result); err != nil {
		util.Logger.Warn("Failed to parse Forge versions response", "error", err.Error())
		return nil, nil
	}

	versions := make([]ForgeVersion, len(result))
	for i, v := range result {
		versions[i] = ForgeVersion{Version: v.Version, McVersion: mcVersion}
	}

	return versions, nil
}

// NeoForgeVersion represents a NeoForge version
type NeoForgeVersion struct {
	Version string `json:"version"`
	Latest  bool   `json:"latest"`
}

// GetNeoForgeVersions returns NeoForge versions
func (s *DownloadService) GetNeoForgeVersions(mcVersion string) ([]NeoForgeVersion, error) {
	url := download.GetBMCLAPIPrefix() + "/neoforge/list/" + mcVersion
	resp, err := s.client.R().Get(url)
	if err != nil {
		return nil, err
	}

	var versions []NeoForgeVersion
	if err := json.Unmarshal(resp.Bytes(), &versions); err != nil {
		util.Logger.Warn("Failed to parse NeoForge versions response", "error", err.Error())
		return nil, nil
	}

	return versions, nil
}

// ForgePromo contains latest/recommended Forge version for a MC version
type ForgePromo struct {
	Latest      string `json:"latest"`
	Recommended string `json:"recommended"`
}

// GetForgePromos returns the Forge promos map (MC version → latest/recommended)
func (s *DownloadService) GetForgePromos() (map[string]ForgePromo, error) {
	url := download.GetBMCLAPIPrefix() + "/forge/promos"
	resp, err := s.client.R().Get(url)
	if err != nil {
		return nil, err
	}

	body := resp.Bytes()

	// Try as map first
	var result map[string]ForgePromo
	if err := json.Unmarshal(body, &result); err == nil {
		return result, nil
	}

	// Try as array of [mcVersion, {latest, recommended}]
	var arrResult []ForgePromoEntry
	if err := json.Unmarshal(body, &arrResult); err != nil {
		util.Logger.Warn("Failed to parse Forge promos response", "error", err.Error())
		return nil, nil
	}

	result = make(map[string]ForgePromo)
	for _, entry := range arrResult {
		result[entry.McVersion] = entry.Promo
	}
	return result, nil
}

// ForgePromoEntry represents a BMCLAPI v2 forge promos array entry
type ForgePromoEntry struct {
	McVersion string     `json:"mcversion"`
	Promo     ForgePromo `json:"promo"`
}

// FabricVersion represents a Fabric version
type FabricVersion struct {
	Version string `json:"version"`
	Stable  bool   `json:"stable"`
}

// GetFabricVersions returns Fabric loader versions
func (s *DownloadService) GetFabricVersions(mcVersion string) ([]FabricVersion, error) {
	url := download.GetBMCLAPIPrefix() + "/fabric-meta/v2/versions/loader/" + mcVersion
	resp, err := s.client.R().Get(url)
	if err != nil {
		return nil, err
	}

	var result []struct {
		Loader struct {
			Version string `json:"version"`
			Stable  bool   `json:"stable"`
		} `json:"loader"`
	}
	if err := json.Unmarshal(resp.Bytes(), &result); err != nil {
		util.Logger.Warn("Failed to parse Fabric versions response", "error", err.Error())
		return nil, nil
	}

	versions := make([]FabricVersion, len(result))
	for i, v := range result {
		versions[i] = FabricVersion{Version: v.Loader.Version, Stable: v.Loader.Stable}
	}

	return versions, nil
}

// StartServerInstall installs a Minecraft server with the given loader
func (s *DownloadService) StartServerInstall(loader, mcVersion, loaderVersion string) {
	util.Logger.Info("[Install] ========== StartServerInstall called ==========",
		"loader", loader,
		"mcVersion", mcVersion,
		"loaderVersion", loaderVersion)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				util.Logger.Error("[Install] PANIC in goroutine", "panic", fmt.Sprint(r))
				app := application.Get()
				app.Event.Emit(dex.EventServerInstallError, map[string]interface{}{
					"error": fmt.Sprintf("panic: %v", r),
				})
			}
		}()

		unpath := filepath.Join(util.GetAppDir(), "instance", loader+"-"+mcVersion+"-"+loaderVersion)
		util.Logger.Info("[Install] Target path", "path", unpath)

		app := application.Get()
		cfg := config.GetConfig()
		util.Logger.Info("[Install] Config",
			"BMCLAPI", cfg.Mirror.BMCLAPI,
			"MCIMirror", cfg.Mirror.MCIMirror,
			"JavaPath", cfg.JavaPath)

		app.Event.Emit(dex.EventServerInstallStart, map[string]interface{}{
			"title":         "Minecraft " + mcVersion + " + " + loader,
			"mcVersion":     mcVersion,
			"loader":        loader,
			"loaderVersion": loaderVersion,
		})
		util.Logger.Info("[Install] Emitted server_install_start")

		progress := func(step string, current, total int) {
			util.Logger.Info("[Install] Step", "step", step, "current", current, "total", total)
			app.Event.Emit(dex.EventServerInstallStep, map[string]interface{}{
				"step":    step,
				"current": current,
				"total":   total,
			})
		}

		err := modloader.MLSetup(loader, mcVersion, loaderVersion, unpath, "", progress)
		if err != nil {
			util.Logger.Error("[Install] MLSetup FAILED", "error", err.Error())
			app.Event.Emit(dex.EventServerInstallError, map[string]interface{}{
				"error": err.Error(),
			})
			util.Logger.Info("[Install] Emitted server_install_error")
			return
		}

		util.Logger.Info("[Install] MLSetup succeeded, emitting complete")
		app.Event.Emit(dex.EventServerInstallComplete, map[string]interface{}{
			"path":        unpath,
			"duration":    0,
			"installPath": unpath,
		})
		util.Logger.Info("[Install] ========== Done ==========")
	}()
}
