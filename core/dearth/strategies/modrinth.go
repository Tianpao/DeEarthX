package strategies

import (
	"encoding/json"

	"resty.dev/v3"

	"deearthx/core/download"
	"deearthx/core/util"
)

// ModrinthFilter checks mods by Modrinth project API
type ModrinthFilter struct {
	urls download.MirrorUrls
}

// NewModrinthFilter creates a new ModrinthFilter
func NewModrinthFilter() *ModrinthFilter {
	return &ModrinthFilter{
		urls: download.GetMirrorUrls(),
	}
}

// Name returns the strategy name
func (mf *ModrinthFilter) Name() string {
	return "ModrinthFilter"
}

// Filter returns client-side mods identified by Modrinth project API
func (mf *ModrinthFilter) Filter(files []FileInfo) ([]string, error) {
	modIDToFilename := make(map[string]string)
	modIDs := []string{}

	// Extract mod IDs from info files
	for _, file := range files {
		for _, info := range file.Infos {
			var config map[string]interface{}
			if err := json.Unmarshal([]byte(info.Data), &config); err != nil {
				continue
			}

			// Fabric mod.json
			if id, ok := config["id"].(string); ok {
				modIDs = append(modIDs, id)
				modIDToFilename[id] = file.Filename
			}
		}
	}

	if len(modIDs) == 0 {
		return []string{}, nil
	}

	util.Logger.Debug("Checking mods with Modrinth project API", "count", len(modIDs))

	client := resty.New()
	client.SetHeader("User-Agent", "DeEarth")

	// Query projects
	projectResp, err := client.R().
		SetQueryParam("ids", "["+joinStrings(modIDs, ",")+"]").
		Get(mf.urls.ModrinthURL + "/v2/projects")

	if err != nil {
		util.Logger.Error("Modrinth project query failed: " + err.Error())
		return nil, err
	}

	if projectResp.StatusCode() >= 400 {
		util.Logger.Error("Modrinth API error: HTTP " + projectResp.Status())
		return []string{}, nil
	}

	var projects []ProjectInfo
	if err := json.Unmarshal(projectResp.Bytes(), &projects); err != nil {
		return nil, err
	}

	// Find client-side only mods
	clientMods := []string{}
	for _, project := range projects {
		if project.ClientSide == "required" && project.ServerSide == "unsupported" {
			filename, exists := modIDToFilename[project.ID]
			if exists {
				clientMods = append(clientMods, filename)
				util.Logger.Debug("Modrinth API marked as client mod",
					"filename", filename,
					"projectId", project.ID)
			}
		}
	}

	util.Logger.Debug("Modrinth check complete", "clientMods", len(clientMods))
	return clientMods, nil
}