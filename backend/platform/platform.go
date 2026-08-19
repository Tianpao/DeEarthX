package platform

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"dex/backend/utils"
)

// XPlatform is the interface that all platform implementations must fulfill.
type XPlatform interface {
	GetInfo(manifest map[string]any) (*ModpackInfo, error)
	DownloadFile(manifest map[string]any, path string, progressFn func(total, completed int, name string)) error
}

// ModpackInfo contains the parsed modpack information.
type ModpackInfo struct {
	Minecraft     string `json:"minecraft"`
	Loader        string `json:"loader"`
	LoaderVersion string `json:"loader_version"`
}

// MirrorUrls holds mirror URL configuration for different platforms.
type MirrorUrls struct {
	ModrinthURL   string
	CurseForgeURL string
	ModrinthDurl  string
	CurseForgeDurl string
}

// GetMirrorUrls returns the mirror URLs based on the config's mcimirror setting.
func GetMirrorUrls() MirrorUrls {
	mcimMode := ""
	if v := utils.GlobalConfig.GetConfigValue("mirror.mcimirror"); v != nil {
		mcimMode = fmt.Sprintf("%v", v)
	}

	switch mcimMode {
	case "on":
		// 全部使用 MCIM 镜像
		return MirrorUrls{
			ModrinthURL:    "https://mod.mcimirror.top/modrinth",
			CurseForgeURL:  "https://mod.mcimirror.top/curseforge",
			ModrinthDurl:   "https://mod.tianpao.top",
			CurseForgeDurl: "https://mod.tianpao.top",
		}
	case "partial":
		// 仅 Modrinth 下载使用 MCIM，API 使用官方
		return MirrorUrls{
			ModrinthURL:    "https://api.modrinth.com",
			CurseForgeURL:  "https://api.curseforge.com",
			ModrinthDurl:   "https://mod.tianpao.top",
			CurseForgeDurl: "https://edge.forgecdn.net",
		}
	default:
		// 'off' 或未设置：全部使用官方源
		return MirrorUrls{
			ModrinthURL:    "https://api.modrinth.com",
			CurseForgeURL:  "https://api.curseforge.com",
			ModrinthDurl:   "https://cdn.modrinth.com",
			CurseForgeDurl: "https://edge.forgecdn.net",
		}
	}
}

// NewPlatform returns an XPlatform implementation based on the platform name.
func NewPlatform(plat string) XPlatform {
	switch plat {
	case "curseforge":
		return NewCurseForge()
	case "modrinth":
		return NewModrinth()
	default:
		return nil
	}
}

// WhatPlatform determines the platform from a manifest filename.
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

// ParseManifest is a helper to parse raw JSON bytes into a map.
func ParseManifest(data []byte) (map[string]any, error) {
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to parse manifest: %w", err)
	}
	return result, nil
}

// loaderIDRe matches loader IDs like "forge-47.3.0" or "neoforge-21.1.1".
var loaderIDRe = regexp.MustCompile(`^([^-]+)-(.*)$`)

// parseLoaderID splits a loader ID string like "forge-47.3.0" into ("forge", "47.3.0").
func parseLoaderID(id string) (loader, version string, ok bool) {
	m := loaderIDRe.FindStringSubmatch(id)
	if len(m) < 3 {
		return "", "", false
	}
	return m[1], m[2], true
}

// getStringFromMap safely extracts a string value from a nested map.
func getStringFromMap(m map[string]any, keys ...string) string {
	var current any = m
	for _, key := range keys {
		switch v := current.(type) {
		case map[string]any:
			current = v[key]
		default:
			return ""
		}
	}
	if s, ok := current.(string); ok {
		return s
	}
	return ""
}

// IsMCIMirrorURL checks if a URL points to the MCIM mirror.
func IsMCIMirrorURL(url string) bool {
	return strings.Contains(url, "mod.tianpao.top")
}
