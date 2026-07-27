package modloader

import (
	"fmt"
	"path/filepath"

	"dex/backend/utils"

	"resty.dev/v3"
)

func NewNeoForge(mcv, mlv, path string) *NeoForge {
	nf := &NeoForge{
		Forge: NewForge(mcv, mlv, path),
	}

	// Override the client with NeoForge-specific base URL
	bmclapi := utils.GlobalConfig.GetConfigValue("mirror.bmclapi")
	baseURL := "https://maven.neoforged.net/releases/"
	if bmclapi == true {
		baseURL = "https://bmclapi2.bangbang93.com/"
	}

	nf.client = resty.New().
		SetBaseURL(baseURL).
		SetHeader("User-Agent", "DeEarthX")

	return nf
}

type NeoForge struct {
	*Forge
}

func (nf *NeoForge) Setup() error {
	// Step 1: Download installer
	if err := nf.Installer(); err != nil {
		return fmt.Errorf("neoforge installer download failed: %w", err)
	}

	// Step 2: Download libraries (if BMCLAPI mirror enabled)
	bmclapi := utils.GlobalConfig.GetConfigValue("mirror.bmclapi")
	if bmclapi == true {
		if err := nf.Library(); err != nil {
			return fmt.Errorf("neoforge library download failed: %w", err)
		}
	}

	// Step 3: Run installer (inherited from Forge)
	if err := nf.Install(); err != nil {
		return fmt.Errorf("neoforge install failed: %w", err)
	}

	// Note: NeoForge does NOT call wshell() - no separate wrapper jar needed
	return nil
}

func (nf *NeoForge) Installer() error {
	bmclapi := utils.GlobalConfig.GetConfigValue("mirror.bmclapi")

	var fullURL string
	if bmclapi == true {
		fullURL = "https://bmclapi2.bangbang93.com/neoforge/version/" + nf.loaderVersion + "/download/installer.jar"
	} else {
		fullURL = "https://maven.neoforged.net/releases/net/neoforged/neoforge/" + nf.loaderVersion + "/neoforge-" + nf.loaderVersion + "-installer.jar"
	}

	filePath := filepath.Join(nf.path, fmt.Sprintf("forge-%s-%s-installer.jar", nf.minecraft, nf.loaderVersion))

	// Use chunked download for large installer jars
	return utils.NewDownloadClient().Download(fullURL, filePath)
}
