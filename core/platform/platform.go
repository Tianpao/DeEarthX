package platform

import "deearthx/core/download"

// ModpackInfo contains parsed modpack information
type ModpackInfo struct {
	Minecraft     string `json:"minecraft"`
	Loader        string `json:"loader"`
	LoaderVersion string `json:"loader_version"`
}

// XPlatform defines the interface for platform handlers
type XPlatform interface {
	GetInfo(manifest map[string]interface{}) (*ModpackInfo, error)
	DownloadFiles(manifest map[string]interface{}, path string, progress download.ProgressCallback) error
}

// Platform creates a platform handler based on platform type
func Platform(plat string) XPlatform {
	switch plat {
	case "curseforge":
		return NewCurseForge()
	case "modrinth":
		return NewModrinth()
	default:
		return nil
	}
}

// WhatPlatform determines platform from manifest filename
func WhatPlatform(filename string) string {
	switch filename {
	case "manifest.json":
		return "curseforge"
	case "modrinth.index.json":
		return "modrinth"
	default:
		return ""
	}
}