package strategies

import (
	"encoding/json"

	"resty.dev/v3"

	"deearthx/core/download"
	"deearthx/core/util"
)

// HashFilter checks mods by SHA1 hash against Modrinth
type HashFilter struct {
	urls download.MirrorUrls
}

// NewHashFilter creates a new HashFilter
func NewHashFilter() *HashFilter {
	return &HashFilter{
		urls: download.GetMirrorUrls(),
	}
}

// Name returns the strategy name
func (hf *HashFilter) Name() string {
	return "HashFilter"
}

// Filter returns client-side mods identified by hash lookup
func (hf *HashFilter) Filter(files []FileInfo) ([]string, error) {
	hashToFilename := make(map[string]string)
	hashes := []string{}

	for _, file := range files {
		hashToFilename[file.Hash] = file.Filename
		hashes = append(hashes, file.Hash)
	}

	util.Logger.Debug("Checking mod hashes with Modrinth API", "count", len(files))

	client := resty.New()
	client.SetHeader("User-Agent", "DeEarth")

	// Query version files by hash
	resp, err := client.R().
		SetHeader("Content-Type", "application/json").
		SetBody(map[string]interface{}{
			"hashes":    hashes,
			"algorithm": "sha1",
		}).
		Post(hf.urls.ModrinthURL + "/v2/version_files")

	if err != nil {
		util.Logger.Error("Hash check failed: " + err.Error())
		return nil, err
	}

	if resp.StatusCode() >= 400 {
		util.Logger.Error("Modrinth API error: HTTP " + resp.Status())
		return []string{}, nil
	}

	// Parse response
	var hashResponse HashResponse
	if err := json.Unmarshal(resp.Bytes(), &hashResponse); err != nil {
		return nil, err
	}

	// Collect project IDs
	projectIDToFilename := make(map[string]string)
	projectIDs := []string{}
	for hash, info := range hashResponse {
		filename, exists := hashToFilename[hash]
		if exists {
			projectIDToFilename[info.ProjectID] = filename
			projectIDs = append(projectIDs, info.ProjectID)
		}
	}

	// Query project info
	projectResp, err := client.R().
		SetQueryParam("ids", "["+joinStrings(projectIDs, ",")+"]").
		Get(hf.urls.ModrinthURL + "/v2/projects")

	if err != nil {
		util.Logger.Error("Project info query failed: " + err.Error())
		return nil, err
	}

	var projects []ProjectInfo
	if err := json.Unmarshal(projectResp.Bytes(), &projects); err != nil {
		return nil, err
	}

	// Find client-side only mods
	clientMods := []string{}
	for _, project := range projects {
		// Client-side only: client_side=required AND server_side=unsupported
		if project.ClientSide == "required" && project.ServerSide == "unsupported" {
			filename, exists := projectIDToFilename[project.ID]
			if exists {
				clientMods = append(clientMods, filename)
				util.Logger.Debug("Modrinth Hash marked as client mod",
					"filename", filename,
					"projectId", project.ID)
			}
		}
	}

	util.Logger.Debug("Hash check complete", "clientMods", len(clientMods))
	return clientMods, nil
}