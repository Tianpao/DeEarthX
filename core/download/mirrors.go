package download

import (
	"deearthx/core/config"
)

// MirrorUrls holds mirror URL configurations
type MirrorUrls struct {
	ModrinthURL    string
	CurseForgeURL  string
	ModrinthDURL   string
	CurseForgeDURL string
}

// GetMirrorUrls returns mirror URLs based on config
func GetMirrorUrls() MirrorUrls {
	cfg := config.GetConfig()
	mcimMode := cfg.Mirror.MCIMirror

	// 'on': Full MCIM mirror
	if mcimMode == "on" {
		return MirrorUrls{
			ModrinthURL:    "https://mod.mcimirror.top/modrinth",
			CurseForgeURL:  "https://mod.mcimirror.top/curseforge",
			ModrinthDURL:   "https://mod.mcimirror.top",
			CurseForgeDURL: "https://mod.mcimirror.top",
		}
	}

	// 'partial': Only download uses MCIM, APIs use official
	if mcimMode == "partial" {
		return MirrorUrls{
			ModrinthURL:    "https://api.modrinth.com",
			CurseForgeURL:  "https://api.curseforge.com",
			ModrinthDURL:   "https://mod.mcimirror.top",
			CurseForgeDURL: "https://edge.forgecdn.net",
		}
	}

	// 'off': All official sources
	return MirrorUrls{
		ModrinthURL:    "https://api.modrinth.com",
		CurseForgeURL:  "https://api.curseforge.com",
		ModrinthDURL:   "https://cdn.modrinth.com",
		CurseForgeDURL: "https://edge.forgecdn.net",
	}
}

// BMCLAPI URL prefixes for Minecraft downloads
const (
	BMCLAPIOfficial  = "https://bmclapi2.bangbang93.com"
	MojangOfficial   = "https://piston-data.mojang.com"
	MojangMeta       = "https://piston-meta.mojang.com"
)

// GetBMCLAPIPrefix returns BMCLAPI prefix for loader APIs (Forge/NeoForge/Fabric)
// Note: Mojang does not host these APIs, so BMCLAPI is always used for them.
func GetBMCLAPIPrefix() string {
	return BMCLAPIOfficial
}

// GetBMCLAPIMetaPrefix returns BMCLAPI meta prefix if enabled
func GetBMCLAPIMetaPrefix() string {
	cfg := config.GetConfig()
	if cfg.Mirror.BMCLAPI {
		return BMCLAPIOfficial
	}
	return MojangMeta
}

// ForgeMavenURLs for Forge downloads
const (
	ForgeMavenOfficial = "https://maven.minecraftforge.net"
	ForgeMavenBMCLAPI  = "https://bmclapi2.bangbang93.com/maven"
)

// GetForgeMavenPrefix returns Forge maven prefix based on mirror config
func GetForgeMavenPrefix() string {
	cfg := config.GetConfig()
	if cfg.Mirror.BMCLAPI {
		return ForgeMavenBMCLAPI
	}
	return ForgeMavenOfficial
}

// NeoForgeMavenURLs for NeoForge downloads
const (
	NeoForgeMavenOfficial = "https://maven.neoforged.net/releases"
	NeoForgeMavenBMCLAPI  = "https://bmclapi2.bangbang93.com/maven"
)

// GetNeoForgeMavenPrefix returns NeoForge maven prefix based on mirror config
func GetNeoForgeMavenPrefix() string {
	cfg := config.GetConfig()
	if cfg.Mirror.BMCLAPI {
		return NeoForgeMavenBMCLAPI
	}
	return NeoForgeMavenOfficial
}

// FabricMavenURLs for Fabric downloads
const (
	FabricMavenOfficial = "https://maven.fabricmc.net"
	FabricMavenBMCLAPI  = "https://bmclapi2.bangbang93.com/maven"
)

// GetFabricMavenPrefix returns Fabric maven prefix based on mirror config
func GetFabricMavenPrefix() string {
	cfg := config.GetConfig()
	if cfg.Mirror.BMCLAPI {
		return FabricMavenBMCLAPI
	}
	return FabricMavenOfficial
}

// IsMCIMirrorURL checks if a URL is from MCIMirror
func IsMCIMirrorURL(url string) bool {
	return contains(url, "mod.mcimirror.top")
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && s[:len(substr)] == substr ||
		len(s) > len(substr) && containsHelper(s, substr)
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}