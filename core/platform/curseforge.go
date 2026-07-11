package platform

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"resty.dev/v3"

	"deearthx/core/download"
	"deearthx/core/util"
)

// CurseForgeManifest represents CurseForge modpack manifest
type CurseForgeManifest struct {
	Minecraft struct {
		Version     string `json:"version"`
		ModLoaders  []struct {
			ID      string `json:"id"`
			Primary bool   `json:"primary"`
		} `json:"modLoaders"`
	} `json:"minecraft"`
	Files []struct {
		ProjectID int `json:"projectID"`
		FileID    int `json:"fileID"`
		Required  bool `json:"required"`
	} `json:"files"`
	Overrides string `json:"overrides"`
}

// CurseForge implements XPlatform for CurseForge modpacks
type CurseForge struct {
	urls     download.MirrorUrls
	client   *resty.Client
	apiKey   string
}

// NewCurseForge creates a new CurseForge platform handler
func NewCurseForge() *CurseForge {
	return &CurseForge{
		urls:   download.GetMirrorUrls(),
		client: resty.New(),
		apiKey: "$2a$10$ydk0TLDG/Gc6uPMdz7mad.iisj2TaMDytVcIW4gcVP231VKngLBKy",
	}
}

// GetInfo parses CurseForge manifest
func (cf *CurseForge) GetInfo(manifest map[string]interface{}) (*ModpackInfo, error) {
	result := &ModpackInfo{}

	// Parse minecraft version
	mc, ok := manifest["minecraft"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid manifest: missing minecraft field")
	}

	version, ok := mc["version"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid manifest: missing minecraft version")
	}
	result.Minecraft = version

	// Parse mod loaders
	loaders, ok := mc["modLoaders"].([]interface{})
	if !ok || len(loaders) == 0 {
		return nil, fmt.Errorf("invalid manifest: missing modLoaders")
	}

	loaderMap, ok := loaders[0].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid manifest: invalid modLoader format")
	}

	id, ok := loaderMap["id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid manifest: missing loader id")
	}

	// Parse loader and version (e.g., "forge-47.2.0")
	parts := strings.SplitN(id, "-", 2)
	if len(parts) == 2 {
		result.Loader = parts[0]
		result.LoaderVersion = parts[1]
	} else {
		result.Loader = id
	}

	return result, nil
}

// DownloadFiles downloads CurseForge mod files
func (cf *CurseForge) DownloadFiles(manifest map[string]interface{}, path string, progress download.ProgressCallback) error {
	// Extract file list
	files, ok := manifest["files"].([]interface{})
	if !ok || len(files) == 0 {
		util.Logger.Warn("CurseForge: No files to download")
		return nil
	}

	// Build file IDs
	fileIDs := make([]int, 0, len(files))
	for _, f := range files {
		fileMap, ok := f.(map[string]interface{})
		if !ok {
			continue
		}
		fileID, ok := fileMap["fileID"].(float64)
		if ok {
			fileIDs = append(fileIDs, int(fileID))
		}
	}

	if len(fileIDs) == 0 {
		return nil
	}

	// Batch request file info from CurseForge API
	req := cf.client.R()
	req.SetHeader("User-Agent", "DeEarthX")
	req.SetHeader("x-api-key", cf.apiKey)
	req.SetHeader("Content-Type", "application/json")
	req.SetBody(map[string]interface{}{
		"fileIds": fileIDs,
	})

	resp, err := req.Post("https://api.curseforge.com/v1/mods/files")
	if err != nil {
		util.Logger.Error("Failed to get CurseForge file info: " + err.Error())
		return err
	}

	if resp.StatusCode() >= 400 {
		return fmt.Errorf("CurseForge API error: HTTP %d", resp.StatusCode())
	}

	// Parse response
	var result struct {
		Data []struct {
			FileName     string  `json:"fileName"`
			DownloadURL  *string `json:"downloadUrl"`
		} `json:"data"`
	}

	if err := json.Unmarshal(resp.Bytes(), &result); err != nil {
		return err
	}

	// Build download list
	downloadList := []download.DownloadOptions{}
	for _, data := range result.Data {
		if strings.HasSuffix(data.FileName, ".zip") || data.DownloadURL == nil {
			continue
		}

		url := *data.DownloadURL
		// Replace official CDN with mirror
		url = strings.Replace(url, "https://edge.forgecdn.net", cf.urls.CurseForgeDURL, 1)

		filePath := filepath.Join(path, "mods", data.FileName)
		downloadList = append(downloadList, download.DownloadOptions{
			URL:          url,
			FilePath:     filePath,
			UseChunked:   true,
			ExtraHeaders: map[string]string{"x-api-key": cf.apiKey},
		})
	}

	// Download files
	if len(downloadList) > 0 {
		util.Logger.Info("[CurseForge] Built download list",
			"manifestFiles", len(files),
			"downloadList", len(downloadList))
		dl := download.NewDownloadClient()
		err = dl.BatchDownload(downloadList, 16, progress)
		if err != nil {
			return err
		}
	}

	return nil
}