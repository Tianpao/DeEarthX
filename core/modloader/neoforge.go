package modloader

import (
	"path/filepath"

	"deearthx/core/config"
	"deearthx/core/download"
	"deearthx/core/util"
)

// NeoForge handles NeoForge mod loader installation
type NeoForge struct {
	*Forge // Embed Forge for shared functionality
}

// NewNeoForge creates a new NeoForge handler
func NewNeoForge(minecraft, loaderVersion, path string) *NeoForge {
	return &NeoForge{
		Forge: NewForge(minecraft, loaderVersion, path),
	}
}

// Setup installs NeoForge
func (n *NeoForge) Setup(progress ProgressCallback) error {
	// Download installer
	if err := n.downloadNeoForgeInstaller(); err != nil {
		return err
	}

	// Download libraries if BMCLAPI enabled
	cfg := config.GetConfig()
	if cfg.Mirror.BMCLAPI {
		if err := n.Forge.downloadLibraries(); err != nil {
			util.Logger.Warn("下载 NeoForge 依赖库失败: " + err.Error())
		}
	}

	// Run installer
	if err := n.Install(); err != nil {
		return err
	}

	return nil
}

// Installer downloads the NeoForge installer
func (n *NeoForge) Installer() error {
	return n.downloadNeoForgeInstaller()
}

// Install runs the NeoForge installer
func (n *NeoForge) Install() error {
	// Same as Forge installer
	return n.Forge.Install()
}

func (n *NeoForge) downloadNeoForgeInstaller() error {
	cfg := config.GetConfig()

	var url string
	var expectedHash string

	if cfg.Mirror.BMCLAPI {
		// BMCLAPI mirror
		url = download.GetBMCLAPIPrefix() + "/neoforge/version/" + n.loaderVersion + "/download/installer.jar"
	} else {
		// Official NeoForge maven
		url = "https://maven.neoforged.net/releases/net/neoforged/neoforge/" + n.loaderVersion + "/neoforge-" + n.loaderVersion + "-installer.jar"
	}

	filePath := filepath.Join(n.path, "forge-"+n.minecraft+"-"+n.loaderVersion+"-installer.jar")

	dl := download.NewDownloadClient()
	return dl.DownloadFile(download.DownloadOptions{
		URL:          url,
		FilePath:     filePath,
		ExpectedHash: expectedHash,
		UseChunked:   false, // BMCLAPI installer jar — simple download like old fastdownload
	}, nil)
}