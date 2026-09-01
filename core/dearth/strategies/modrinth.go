package strategies

import (
	"encoding/json"

	"resty.dev/v3"

	"deearthx/core/download"
	"deearthx/core/util"
)

// ModrinthFilter checks mods by Modrinth project API (project_id from pack metadata)
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

func extractModrinthProjectID(infos []InfoFile) string {
	for _, info := range infos {
		if info.Name != "modrinth.index.json" && info.Name != "modrinth.json" {
			continue
		}
		var data struct {
			ProjectID string `json:"project_id"`
		}
		if err := json.Unmarshal([]byte(info.Data), &data); err != nil {
			continue
		}
		if data.ProjectID != "" {
			return data.ProjectID
		}
	}
	return ""
}

func isModrinthClientMod(p ProjectInfo) bool {
	// Align with old TS ModrinthFilter.isClientMod
	return p.ClientSide == "required" ||
		(p.ClientSide == "optional" && p.ServerSide == "unsupported")
}

// Filter returns client-side mods identified by Modrinth project API
func (mf *ModrinthFilter) Filter(files []FileInfo) ([]string, error) {
	type pair struct {
		filename  string
		projectID string
	}
	pairs := []pair{}
	seen := make(map[string]bool)
	uniqueIDs := []string{}

	for _, file := range files {
		projectID := extractModrinthProjectID(file.Infos)
		if projectID == "" {
			continue
		}
		pairs = append(pairs, pair{filename: file.Filename, projectID: projectID})
		if !seen[projectID] {
			seen[projectID] = true
			uniqueIDs = append(uniqueIDs, projectID)
		}
	}

	if len(uniqueIDs) == 0 {
		util.Logger.Debug("未找到 Modrinth 项目 ID")
		return []string{}, nil
	}

	util.Logger.Debug("找到 Modrinth 项目", "数量", len(uniqueIDs))

	client := resty.New()
	client.SetHeader("User-Agent", "DeEarth")

	projects, err := fetchModrinthProjects(client, mf.urls.ModrinthURL, uniqueIDs)
	if err != nil {
		util.Logger.Error("Modrinth 项目查询失败: " + err.Error())
		return []string{}, nil
	}

	projectMap := make(map[string]ProjectInfo, len(projects))
	for _, p := range projects {
		projectMap[p.ID] = p
	}

	clientMods := []string{}
	for _, item := range pairs {
		project, ok := projectMap[item.projectID]
		if !ok {
			continue
		}
		if isModrinthClientMod(project) {
			clientMods = append(clientMods, item.filename)
			util.Logger.Debug("Modrinth 标记为客户端模组",
				"filename", item.filename,
				"projectId", item.projectID)
		}
	}

	util.Logger.Debug("Modrinth 检查完成", "clientMods", len(clientMods))
	return clientMods, nil
}
