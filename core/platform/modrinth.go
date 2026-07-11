package platform

import (
	"path/filepath"
	"strings"

	"deearthx/core/download"
	"deearthx/core/util"
)

// ModrinthManifest represents Modrinth modpack manifest
type ModrinthManifest struct {
	FormatVersion int    `json:"formatVersion"`
	Game          string `json:"game"`
	VersionID     string `json:"versionId"`
	Name          string `json:"name"`
	Files         []struct {
		Path     string   `json:"path"`
		Hashes   struct {
			Sha1 string `json:"sha1"`
			Sha512 string `json:"sha512"`
		} `json:"hashes"`
		Env      map[string]bool `json:"env"`
		Downloads []string `json:"downloads"`
		FileSize int `json:"fileSize"`
	} `json:"files"`
	Dependencies map[string]string `json:"dependencies"`
}

// Modrinth implements XPlatform for Modrinth modpacks
type Modrinth struct {
	urls download.MirrorUrls
}

// NewModrinth creates a new Modrinth platform handler
func NewModrinth() *Modrinth {
	return &Modrinth{
		urls: download.GetMirrorUrls(),
	}
}

// GetInfo parses Modrinth manifest
func (m *Modrinth) GetInfo(manifest map[string]interface{}) (*ModpackInfo, error) {
	result := &ModpackInfo{}

	// Parse dependencies
	deps, ok := manifest["dependencies"].(map[string]interface{})
	if !ok {
		return nil, nil
	}

	// Get minecraft version
	mc, ok := deps["minecraft"].(string)
	if ok {
		result.Minecraft = mc
	}

	// Get loader
	loaders := []string{"forge", "neoforge", "fabric-loader", "quilt-loader"}
	for key, val := range deps {
		for _, loader := range loaders {
			if key == loader {
				result.Loader = key
				if strVal, ok := val.(string); ok {
					result.LoaderVersion = strVal
				}
				break
			}
		}
	}

	// Normalize loader name
	if result.Loader == "fabric-loader" {
		result.Loader = "fabric"
	}

	return result, nil
}

// DownloadFiles downloads Modrinth mod files
func (m *Modrinth) DownloadFiles(manifest map[string]interface{}, path string, progress download.ProgressCallback) error {
	// Extract files
	files, ok := manifest["files"].([]interface{})
	if !ok || len(files) == 0 {
		return nil
	}

	// Build download list
	downloadList := []download.DownloadOptions{}
	for _, f := range files {
		fileMap, ok := f.(map[string]interface{})
		if !ok {
			continue
		}

		filePath, ok := fileMap["path"].(string)
		if !ok {
			continue
		}

		// Skip zip files
		if strings.HasSuffix(filePath, ".zip") {
			continue
		}

		// Get downloads array
		downloads, ok := fileMap["downloads"].([]interface{})
		if !ok || len(downloads) == 0 {
			continue
		}

		url, ok := downloads[0].(string)
		if !ok {
			continue
		}

		// Replace CDN with mirror
		url = strings.Replace(url, "https://cdn.modrinth.com", m.urls.ModrinthDURL, 1)

		// Get hash
		var expectedHash string
		if hashes, ok := fileMap["hashes"].(map[string]interface{}); ok {
			if sha1, ok := hashes["sha1"].(string); ok {
				expectedHash = sha1
			}
		}

		destPath := filepath.Join(path, filePath)
		downloadList = append(downloadList, download.DownloadOptions{
			URL:          url,
			FilePath:     destPath,
			ExpectedHash: expectedHash,
			UseChunked:   true,
		})
	}

	// Download files
	if len(downloadList) > 0 {
		util.Logger.Info("[Modrinth] Built download list",
			"manifestFiles", len(files),
			"downloadList", len(downloadList))
		dl := download.NewDownloadClient()
		err := dl.BatchDownload(downloadList, 16, progress)
		if err != nil {
			return err
		}
	}

	return nil
}
