package ziputil

import (
	"encoding/json"
	"strings"
)

// InfoFile represents a mod info file extracted from a JAR
type InfoFile struct {
	Name string `json:"name"`
	Data string `json:"data"`
}

// MixinFile represents a mixin config file extracted from a JAR
type MixinFile struct {
	Name string `json:"name"`
	Data string `json:"data"`
}

// ExtractModInfo extracts mod metadata files from a JAR
// Looks for mods.toml (Forge/NeoForge) and fabric.mod.json
func ExtractModInfo(jarData []byte) []InfoFile {
	entries, err := ReadZip(jarData)
	if err != nil {
		return nil
	}

	infos := []InfoFile{}
	for _, entry := range entries {
		if entry.IsDir {
			continue
		}

		name := entry.Name
		if strings.HasSuffix(name, "neoforge.mods.toml") ||
			strings.HasSuffix(name, "mods.toml") {
			// Parse TOML - for now, just store raw data
			// Go doesn't have a built-in TOML parser, so we store as string
			infos = append(infos, InfoFile{
				Name: name,
				Data: string(entry.Data),
			})
		} else if strings.HasSuffix(name, "fabric.mod.json") {
			infos = append(infos, InfoFile{
				Name: name,
				Data: string(entry.Data),
			})
		}
	}

	return infos
}

// ExtractMixins extracts mixin configuration files from a JAR
// Looks for *.mixins.json files at root level
func ExtractMixins(jarData []byte) []MixinFile {
	entries, err := ReadZip(jarData)
	if err != nil {
		return nil
	}

	mixins := []MixinFile{}
	for _, entry := range entries {
		if entry.IsDir {
			continue
		}

		name := entry.Name
		// Root-level mixin files only (no directory separators)
		if strings.HasSuffix(name, ".mixins.json") && !strings.Contains(name, "/") {
			mixins = append(mixins, MixinFile{
				Name: name,
				Data: string(entry.Data),
			})
		}
	}

	return mixins
}

// ParseFabricMod parses a fabric.mod.json file
type FabricMod struct {
	ID       string `json:"id"`
	Version  string `json:"version"`
	Name     string `json:"name"`
	Author   string `json:"author"`
	Side     string `json:"side"` // "universal", "client", "server"
	IconPath string `json:"iconPath"`
}

func ParseFabricMod(data string) (*FabricMod, error) {
	var mod FabricMod
	err := json.Unmarshal([]byte(data), &mod)
	if err != nil {
		return nil, err
	}
	return &mod, nil
}

// ParseForgeModsToml parses a Forge/NeoForge mods.toml file
// Returns a simplified structure for mod info extraction
type ForgeMod struct {
	ModID       string `toml:"modId"`
	Version     string `toml:"version"`
	DisplayName string `toml:"displayName"`
	Authors     string `toml:"authors"`
	Side        string `toml:"side"` // "CLIENT", "SERVER", "BOTH"
}

// For TOML parsing, we need to import a TOML library
// This is a placeholder - actual implementation needs a TOML parser
func ParseForgeModsToml(data string) ([]ForgeMod, error) {
	// Basic parsing without full TOML support
	// Extract modId, version, displayName from simple TOML format
	mods := []ForgeMod{}

	// Simple regex-based parsing for basic TOML
	// This is a simplified approach - a proper TOML parser would be better
	lines := strings.Split(strings.TrimSpace(data), "\n")
	var currentMod ForgeMod
	inModBlock := false

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "[[mods]]") {
			if inModBlock && currentMod.ModID != "" {
				mods = append(mods, currentMod)
			}
			currentMod = ForgeMod{}
			inModBlock = true
			continue
		}
		if inModBlock && strings.Contains(line, "=") {
			parts := strings.SplitN(line, "=", 2)
			key := strings.TrimSpace(parts[0])
			value := strings.Trim(strings.TrimSpace(parts[1]), "\"")

			switch key {
			case "modId":
				currentMod.ModID = value
			case "version":
				currentMod.Version = value
			case "displayName":
				currentMod.DisplayName = value
			case "authors":
				currentMod.Authors = value
			case "side":
				currentMod.Side = value
			}
		}
	}

	if inModBlock && currentMod.ModID != "" {
		mods = append(mods, currentMod)
	}

	return mods, nil
}