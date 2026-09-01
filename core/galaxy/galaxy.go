package galaxy

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"resty.dev/v3"

	"deearthx/core/util"
	"deearthx/core/ziputil"
)

// Galaxy handles mod ID submission to Galaxy Square
type Galaxy struct {
	client *resty.Client
}

// NewGalaxy creates a new Galaxy handler
func NewGalaxy() *Galaxy {
	return &Galaxy{
		client: resty.New().
			SetBaseURL("https://galaxy.tianpao.top/").
			SetHeader("User-Agent", "DeEarthX"),
	}
}

// UploadModsFromPaths extracts mod IDs from file paths
func (g *Galaxy) UploadModsFromPaths(paths []string) ([]string, error) {
	modIDs := []string{}

	for _, filePath := range paths {
		if _, err := os.Stat(filePath); err != nil {
			continue
		}

		data, err := os.ReadFile(filePath)
		if err != nil {
			continue
		}

		// Extract mod ID from JAR
		extractedIDs := g.extractModID(data)
		modIDs = append(modIDs, extractedIDs...)
	}

	util.Logger.Info("Extracted mod IDs from paths", "count", len(modIDs))
	return modIDs, nil
}

// UploadModsFromBuffers extracts mod IDs from file buffers
func (g *Galaxy) UploadModsFromBuffers(files [][]byte) ([]string, error) {
	modIDs := []string{}

	for _, data := range files {
		extractedIDs := g.extractModID(data)
		modIDs = append(modIDs, extractedIDs...)
	}

	return modIDs, nil
}

// SubmitModIDs submits mod IDs to Galaxy Square
func (g *Galaxy) SubmitModIDs(modType string, modIDs []string) error {
	modIDStr := strings.Join(modIDs, ",")

	resp, err := g.client.R().
		SetBody(map[string]string{"modid": modIDStr}).
		Post("mod/submit/" + modType)

	if err != nil {
		util.Logger.Error("Failed to submit mod IDs: " + err.Error())
		return err
	}

	if resp.StatusCode() >= 400 {
		util.Logger.Error("Galaxy API error: HTTP " + resp.Status())
		return nil
	}

	util.Logger.Info("Submitted mod IDs to Galaxy Square", "type", modType, "count", len(modIDs))
	return nil
}

func (g *Galaxy) extractModID(jarData []byte) []string {
	modIDs := []string{}

	entries, err := ziputil.ReadZip(jarData)
	if err != nil {
		return modIDs
	}

	for _, entry := range entries {
		// Forge/NeoForge mods.toml
		if strings.HasSuffix(entry.Name, "mods.toml") || strings.HasSuffix(entry.Name, "neoforge.mods.toml") {
			modID := parseForgeModID(string(entry.Data))
			if modID != "" {
				modIDs = append(modIDs, modID)
			}
		}

		// Fabric fabric.mod.json
		if strings.HasSuffix(entry.Name, "fabric.mod.json") {
			modID := parseFabricModID(string(entry.Data))
			if modID != "" {
				modIDs = append(modIDs, modID)
			}
		}
	}

	return modIDs
}

func parseForgeModID(tomlData string) string {
	// Simple TOML parsing for modId
	lines := strings.Split(tomlData, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "modId") {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				modID := strings.Trim(strings.TrimSpace(parts[1]), "\"")
				return modID
			}
		}
	}
	return ""
}

func parseFabricModID(jsonData string) string {
	var config struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(jsonData), &config); err != nil {
		return ""
	}
	return config.ID
}

// GetModIDsFromFile extracts mod IDs from a single file
func GetModIDsFromFile(filePath string) ([]string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	g := NewGalaxy()
	return g.extractModID(data), nil
}

// GetFilename returns just the filename from a path
func GetFilename(path string) string {
	return filepath.Base(path)
}