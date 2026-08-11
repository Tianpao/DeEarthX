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
	verdicts := hf.Verdicts(files)
	var clientMods []string
	for f, v := range verdicts {
		if v == types.VerdictClient {
			clientMods = append(clientMods, f)
		}
	}
	return clientMods, nil
}

// Verdicts returns, per file, how Modrinth (resolved by SHA1) classifies it:
// VerdictClient for client-only, VerdictServer for known dual/server-capable,
// or absent (VerdictUnknown) when Modrinth has no data on the file.
func (hf *HashFilter) Verdicts(files []types.FileInfo) map[string]types.SideVerdict {
	result := make(map[string]types.SideVerdict)
	if len(files) == 0 {
		return result
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
		return result
	}

	var hashResponse map[string]struct {
		ProjectID string `json:"project_id"`
	}
	if err := json.Unmarshal(resp.Bytes(), &hashResponse); err != nil {
		slog.Error("Hash filter: failed to parse response", "error", err)
		return result
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
		return result
	}

	idsJSON, _ := json.Marshal(projectIDs)
	params := url.Values{"ids": {string(idsJSON)}}
	projectsResp, err := hf.client.R().
		Get(hf.urls.ModrinthURL + "/v2/projects?" + params.Encode())
	if err != nil {
		slog.Error("Hash filter: Modrinth projects API error", "error", err)
		return result
	}

	var projects []struct {
		ID         string `json:"id"`
		ClientSide string `json:"client_side"`
		ServerSide string `json:"server_side"`
	}
	if err := json.Unmarshal(projectsResp.Bytes(), &projects); err != nil {
		slog.Error("Hash filter: failed to parse projects response", "error", err)
		return result
	}

	for _, p := range projects {
		filename, ok := projectIDToFilename[p.ID]
		if !ok {
			continue
		}
		if p.ClientSide == "required" && p.ServerSide == "unsupported" {
			result[filename] = types.VerdictClient
		} else {
			result[filename] = types.VerdictServer
		}
	}

	return result
}
