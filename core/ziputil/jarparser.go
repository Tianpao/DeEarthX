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
// Looks for mods.toml (Forge/NeoForge) and fabric.mod.json.
// Forge TOML is converted to JSON so downstream filters can JSON-parse it (matches TS jar-parser).
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
			infos = append(infos, InfoFile{
				Name: name,
				Data: modsTomlToJSON(string(entry.Data)),
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

// modsTomlToJSON converts Forge/NeoForge mods.toml into JSON with mods + dependencies.
func modsTomlToJSON(tomlData string) string {
	result := map[string]interface{}{
		"mods":         []map[string]string{},
		"dependencies": map[string][]map[string]string{},
	}

	mods := []map[string]string{}
	deps := map[string][]map[string]string{}

	lines := strings.Split(tomlData, "\n")
	var current map[string]string
	var currentDepOwner string
	inMods := false
	inDeps := false

	flushMod := func() {
		if inMods && current != nil && current["modId"] != "" {
			mods = append(mods, current)
		}
		if inDeps && current != nil && currentDepOwner != "" && current["modId"] != "" {
			deps[currentDepOwner] = append(deps[currentDepOwner], current)
		}
		current = nil
	}

	for _, raw := range lines {
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		if strings.HasPrefix(line, "[[mods]]") {
			flushMod()
			inMods = true
			inDeps = false
			currentDepOwner = ""
			current = map[string]string{}
			continue
		}

		if strings.HasPrefix(line, "[[dependencies.") && strings.HasSuffix(line, "]]") {
			flushMod()
			inMods = false
			inDeps = true
			owner := strings.TrimSuffix(strings.TrimPrefix(line, "[[dependencies."), "]]")
			currentDepOwner = strings.Trim(owner, "\"")
			current = map[string]string{}
			continue
		}

		// New section header ends current table
		if strings.HasPrefix(line, "[") {
			flushMod()
			inMods = false
			inDeps = false
			currentDepOwner = ""
			current = nil
			continue
		}

		if current == nil || !strings.Contains(line, "=") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, "\"'")
		current[key] = value
	}
	flushMod()

	result["mods"] = mods
	result["dependencies"] = deps
	data, err := json.Marshal(result)
	if err != nil {
		return "{}"
	}
	return string(data)
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