package modloader

import (
	"dex/backend/utils"
	"path/filepath"
)

func NewNeoForge(mcv, mlv, path string) *NeoForge {
	return &NeoForge{
		Forge: NewForge(mcv, mlv, path),
	}
}

type NeoForge struct {
	*Forge
}

func (super *NeoForge) Installer() error {
	var url string
	var expectedHash string

	if utils.GlobalConfig.GetConfigValue("mirror.bmclapi") == true {
		url = "https://bmclapi2.bangbang93.com" + "/neoforge/version/" + super.loaderVersion + "/download/installer.jar"
	} else {
		url = "https://maven.neoforged.net/releases/net/neoforged/neoforge/" + super.loaderVersion + "/neoforge-" + super.loaderVersion + "-installer.jar"
	}
	
	filePath := filepath.Join(super.path, "forge-"+super.minecraft+"-"+super.loaderVersion+"-installer.jar")

	return nil
}
