package strategies

import (
	"encoding/json"
	"fmt"

	"resty.dev/v3"

	"deearthx/core/util"
)

const modrinthProjectBatchSize = 100

// fetchModrinthProjects queries /v2/projects with a proper JSON ids array
// (must be `["a","b"]`, not `[a,b]`). Batches to avoid URL length limits.
func fetchModrinthProjects(client *resty.Client, baseURL string, ids []string) ([]ProjectInfo, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	var all []ProjectInfo
	for i := 0; i < len(ids); i += modrinthProjectBatchSize {
		end := i + modrinthProjectBatchSize
		if end > len(ids) {
			end = len(ids)
		}
		batch := ids[i:end]

		idsJSON, err := json.Marshal(batch)
		if err != nil {
			return nil, err
		}

		resp, err := client.R().
			SetQueryParam("ids", string(idsJSON)).
			Get(baseURL + "/v2/projects")
		if err != nil {
			return nil, err
		}

		if resp.StatusCode() >= 400 {
			util.Logger.Error("Modrinth API 错误: HTTP " + resp.Status())
			// Skip this batch; keep whatever we already have
			continue
		}

		var projects []ProjectInfo
		if err := json.Unmarshal(resp.Bytes(), &projects); err != nil {
			return nil, fmt.Errorf("decode projects: %w", err)
		}
		all = append(all, projects...)
	}
	return all, nil
}
