package strategies

import (
	"encoding/json"
	"fmt"

	"dex/backend/dearth/types"
	"dex/backend/platform"

	"resty.dev/v3"
)

// ModrinthFilter checks mods by reading embedded modrinth.json project IDs.
type ModrinthFilter struct {
	urls   platform.MirrorUrls
	client *resty.Client
}

func NewModrinthFilter() *ModrinthFilter {
	return &ModrinthFilter{
		urls:   platform.GetMirrorUrls(),
		client: resty.New().SetHeader("User-Agent", "DeEarth"),
	}
}

func (mf *ModrinthFilter) Name() string { return "ModrinthFilter" }

func (mf *ModrinthFilter) Filter(files []types.FileInfo) ([]string, error) {
	type fileProject struct {
		filename  string
		projectID string
	}

	var fileProjects []fileProject
	for _, file := range files {
		projectID := mf.extractProjectID(file.Infos)
		if projectID != "" {
			fileProjects = append(fileProjects, fileProject{filename: file.Filename, projectID: projectID})
		}
	}

	if len(fileProjects) == 0 {
		return nil, nil
	}

	seen := make(map[string]bool)
	var uniqueIDs []string
	for _, fp := range fileProjects {
		if !seen[fp.projectID] {
			seen[fp.projectID] = true
			uniqueIDs = append(uniqueIDs, fp.projectID)
		}
	}

	projectMap := mf.fetchProjectInfo(uniqueIDs)

	var clientMods []string
	for _, fp := range fileProjects {
		project, ok := projectMap[fp.projectID]
		if ok && isClientMod(project) {
			clientMods = append(clientMods, fp.filename)
		}
	}

	return clientMods, nil
}

func (mf *ModrinthFilter) extractProjectID(infos []types.InfoFile) string {
	for _, info := range infos {
		if info.Name == "modrinth.index.json" || info.Name == "modrinth.json" {
			var data struct {
				ProjectID string `json:"project_id"`
			}
			if err := json.Unmarshal([]byte(info.Data), &data); err == nil && data.ProjectID != "" {
				return data.ProjectID
			}
		}
	}
	return ""
}

type modrinthProject struct {
	ClientSide  string   `json:"client_side"`
	ServerSide  string   `json:"server_side"`
	ProjectType string   `json:"project_type"`
	Categories  []string `json:"categories"`
}

func (mf *ModrinthFilter) fetchProjectInfo(projectIDs []string) map[string]modrinthProject {
	result := make(map[string]modrinthProject)
	batchSize := 50

	for i := 0; i < len(projectIDs); i += batchSize {
		end := i + batchSize
		if end > len(projectIDs) {
			end = len(projectIDs)
		}
		batch := projectIDs[i:end]

		idsParam := ""
		for j, id := range batch {
			if j > 0 {
				idsParam += ","
			}
			idsParam += id
		}

		resp, err := mf.client.R().
			SetHeader("Content-Type", "application/json").
			Post(mf.urls.ModrinthURL + "/v2/projects?ids=" + idsParam)
		if err != nil {
			fmt.Printf("Modrinth filter: batch query error: %v\n", err)
			continue
		}

		var projects []struct {
			ID          string   `json:"id"`
			ClientSide  string   `json:"client_side"`
			ServerSide  string   `json:"server_side"`
			ProjectType string   `json:"project_type"`
			Categories  []string `json:"categories"`
		}
		if err := json.Unmarshal(resp.Bytes(), &projects); err != nil {
			continue
		}

		for _, p := range projects {
			result[p.ID] = modrinthProject{
				ClientSide: p.ClientSide, ServerSide: p.ServerSide,
				ProjectType: p.ProjectType, Categories: p.Categories,
			}
		}
	}

	return result
}

func isClientMod(project modrinthProject) bool {
	return project.ClientSide == "required" ||
		(project.ClientSide == "optional" && project.ServerSide == "unsupported")
}
