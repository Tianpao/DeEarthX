package strategies

import (
	"encoding/json"
	"log/slog"
	"net/url"

	"dex/backend/dearth/types"
	"dex/backend/platform"

	"resty.dev/v3"
)

// HashFilter checks mods by querying Modrinth's version_files API with SHA1 hashes.
type HashFilter struct {
	urls   platform.MirrorUrls
	client *resty.Client
}

func NewHashFilter() *HashFilter {
	return &HashFilter{
		urls:   platform.GetMirrorUrls(),
		client: resty.New().SetHeader("User-Agent", "DeEarth"),
	}
}

func (hf *HashFilter) Name() string { return "HashFilter" }

func (hf *HashFilter) Filter(files []types.FileInfo) ([]string, error) {
	if len(files) == 0 {
		return nil, nil
	}

	hashToFilename := make(map[string]string)
	hashes := make([]string, len(files))
	for i, file := range files {
		hashToFilename[file.Hash] = file.Filename
		hashes[i] = file.Hash
	}

	resp, err := hf.client.R().
		SetHeader("Content-Type", "application/json").
		SetBody(map[string]any{"hashes": hashes, "algorithm": "sha1"}).
		Post(hf.urls.ModrinthURL + "/v2/version_files")
	if err != nil {
		slog.Error("Hash filter: Modrinth version_files API error", "error", err)
		return nil, nil
	}

	var hashResponse map[string]struct {
		ProjectID string `json:"project_id"`
	}
	if err := json.Unmarshal(resp.Bytes(), &hashResponse); err != nil {
		slog.Error("Hash filter: failed to parse response", "error", err)
		return nil, nil
	}

	projectIDToFilename := make(map[string]string)
	projectIDs := make([]string, 0)
	for hash, info := range hashResponse {
		if filename, ok := hashToFilename[hash]; ok {
			projectIDToFilename[info.ProjectID] = filename
			projectIDs = append(projectIDs, info.ProjectID)
		}
	}

	if len(projectIDs) == 0 {
		return nil, nil
	}

	idsJSON, _ := json.Marshal(projectIDs)
	params := url.Values{"ids": {string(idsJSON)}}
	projectsResp, err := hf.client.R().
		Get(hf.urls.ModrinthURL + "/v2/projects?" + params.Encode())
	if err != nil {
		slog.Error("Hash filter: Modrinth projects API error", "error", err)
		return nil, nil
	}

	var projects []struct {
		ID         string `json:"id"`
		ClientSide string `json:"client_side"`
		ServerSide string `json:"server_side"`
	}
	if err := json.Unmarshal(projectsResp.Bytes(), &projects); err != nil {
		slog.Error("Hash filter: failed to parse projects response", "error", err)
		return nil, nil
	}

	var clientMods []string
	for _, p := range projects {
		if p.ClientSide == "required" && p.ServerSide == "unsupported" {
			if filename, ok := projectIDToFilename[p.ID]; ok {
				clientMods = append(clientMods, filename)
			}
		}
	}

	return clientMods, nil
}
