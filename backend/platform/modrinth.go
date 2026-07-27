package platform

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"dex/backend/utils"
)

func NewModrinth() *Modrinth {
	return &Modrinth{
		urls: GetMirrorUrls(),
	}
}

type Modrinth struct {
	urls MirrorUrls
}

// modrinthManifest describes the structure of a Modrinth modrinth.index.json.
type modrinthManifest struct {
	Files []struct {
		Path      string   `json:"path"`
		Downloads []string `json:"downloads"`
		FileSize  int      `json:"fileSize"`
	} `json:"files"`
	Dependencies map[string]string `json:"dependencies"`
}

func (m *Modrinth) GetInfo(manifest map[string]any) (*ModpackInfo, error) {
	// Marshal back to JSON then parse into typed struct
	data, err := json.Marshal(manifest)
	if err != nil {
		return nil, fmt.Errorf("failed to re-marshal modrinth manifest: %w", err)
	}

	var mrManifest modrinthManifest
	if err := json.Unmarshal(data, &mrManifest); err != nil {
		return nil, fmt.Errorf("failed to parse modrinth manifest: %w", err)
	}

	result := &ModpackInfo{
		Minecraft: mrManifest.Dependencies["minecraft"],
	}

	// Find the mod loader from dependencies
	loaders := []string{"forge", "neoforge", "fabric-loader"}
	for _, key := range loaders {
		if _, ok := mrManifest.Dependencies[key]; ok {
			result.Loader = key
			result.LoaderVersion = mrManifest.Dependencies[key]
			break
		}
	}

	return result, nil
}

func (m *Modrinth) DownloadFile(manifest map[string]any, path string, progressFn func(total, completed int, name string)) error {
	// Parse manifest
	data, err := json.Marshal(manifest)
	if err != nil {
		return fmt.Errorf("failed to re-marshal modrinth manifest: %w", err)
	}

	var mrManifest modrinthManifest
	if err := json.Unmarshal(data, &mrManifest); err != nil {
		return fmt.Errorf("failed to parse modrinth manifest: %w", err)
	}

	// Build download list
	var downloadItems []utils.DownloadOption
	for _, e := range mrManifest.Files {
		// Skip .zip files
		if strings.HasSuffix(e.Path, ".zip") {
			continue
		}

		if len(e.Downloads) == 0 {
			continue
		}

		// Replace official CDN domain with mirror URL
		url := strings.Replace(e.Downloads[0], "https://cdn.modrinth.com", m.urls.ModrinthDurl, 1)
		unpath := filepath.Join(path, e.Path)

		downloadItems = append(downloadItems, utils.DownloadOption{
			URL:        url,
			FilePath:   unpath,
			UseChunked: true,
		})
	}

	if len(downloadItems) == 0 {
		return nil
	}

	// Use WFastDownload with progress reporting and chunked downloads enabled
	return utils.WFastDownload(downloadItems, progressFn)
}
