package platform

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"dex/backend/utils"

	"resty.dev/v3"
)

// CurseForgeAPIKey is the hardcoded CurseForge API key (same as the TS reference).
const CurseForgeAPIKey = "$2a$10$ydk0TLDG/Gc6uPMdz7mad.iisj2TaMDytVcIW4gcVP231VKngLBKy"

func NewCurseForge() *CurseForge {
	return &CurseForge{
		urls:   GetMirrorUrls(),
		apiKey: CurseForgeAPIKey,
		client: resty.New().
			SetBaseURL("https://api.curseforge.com").
			SetHeader("User-Agent", "DeEarthX").
			SetHeader("x-api-key", CurseForgeAPIKey).
			SetHeader("Content-Type", "application/json"),
	}
}

type CurseForge struct {
	urls   MirrorUrls
	apiKey string
	client *resty.Client
}

// curseForgeManifest describes the structure of a CurseForge modpack manifest.json.
type curseForgeManifest struct {
	Minecraft struct {
		Version     string `json:"version"`
		ModLoaders  []struct {
			ID string `json:"id"`
		} `json:"modLoaders"`
	} `json:"minecraft"`
	Files []struct {
		ProjectID int `json:"projectID"`
		FileID    int `json:"fileID"`
	} `json:"files"`
}

// curseForgeFileResponse describes the response from POST /v1/mods/files.
type curseForgeFileResponse struct {
	Data []struct {
		FileName    string  `json:"fileName"`
		DownloadURL *string `json:"downloadUrl"`
	} `json:"data"`
}

func (cf *CurseForge) GetInfo(manifest map[string]any) (*ModpackInfo, error) {
	// Marshal back to JSON then parse into typed struct
	data, err := json.Marshal(manifest)
	if err != nil {
		return nil, fmt.Errorf("failed to re-marshal curseforge manifest: %w", err)
	}

	var cfManifest curseForgeManifest
	if err := json.Unmarshal(data, &cfManifest); err != nil {
		return nil, fmt.Errorf("failed to parse curseforge manifest: %w", err)
	}

	result := &ModpackInfo{
		Minecraft: cfManifest.Minecraft.Version,
	}

	if len(cfManifest.Minecraft.ModLoaders) > 0 {
		id := cfManifest.Minecraft.ModLoaders[0].ID
		if loader, version, ok := parseLoaderID(id); ok {
			result.Loader = loader
			result.LoaderVersion = version
		}
	}

	return result, nil
}

func (cf *CurseForge) DownloadFile(manifest map[string]any, path string, progressFn func(total, completed int, name string)) error {
	// Parse manifest
	data, err := json.Marshal(manifest)
	if err != nil {
		return fmt.Errorf("failed to re-marshal curseforge manifest: %w", err)
	}

	var cfManifest curseForgeManifest
	if err := json.Unmarshal(data, &cfManifest); err != nil {
		return fmt.Errorf("failed to parse curseforge manifest: %w", err)
	}

	if len(cfManifest.Files) == 0 {
		return nil
	}

	// Collect file IDs
	fileIDs := make([]int, len(cfManifest.Files))
	for i, f := range cfManifest.Files {
		fileIDs[i] = f.FileID
	}

	// POST to CurseForge API to get file download metadata
	resp, err := cf.client.R().
		SetBody(map[string]any{"fileIds": fileIDs}).
		Post("v1/mods/files")
	if err != nil {
		return fmt.Errorf("failed to fetch curseforge file info: %w", err)
	}
	if resp.StatusCode() >= 400 {
		return fmt.Errorf("curseforge API returned HTTP %d: %s", resp.StatusCode(), string(resp.Bytes()))
	}

	var fileResp curseForgeFileResponse
	if err := json.Unmarshal(resp.Bytes(), &fileResp); err != nil {
		return fmt.Errorf("failed to parse curseforge file response: %w", err)
	}

	// Build download list
	var downloadItems []utils.DownloadOption
	for _, e := range fileResp.Data {
		// Skip .zip files and entries with null download URLs
		if strings.HasSuffix(e.FileName, ".zip") || e.DownloadURL == nil || *e.DownloadURL == "" {
			continue
		}

		unpath := filepath.Join(path, "mods", e.FileName)
		// Replace official CDN domain with mirror URL
		url := strings.Replace(*e.DownloadURL, "https://edge.forgecdn.net", cf.urls.CurseForgeDurl, 1)

		downloadItems = append(downloadItems, utils.DownloadOption{
			URL:        url,
			FilePath:   unpath,
			UseChunked: true,
		})
	}

	if len(downloadItems) == 0 {
		fmt.Println("CurseForge: no downloadable files found")
		return nil
	}

	// Use WFastDownload with progress reporting and chunked downloads enabled
	return utils.WFastDownload(downloadItems, progressFn)
}
