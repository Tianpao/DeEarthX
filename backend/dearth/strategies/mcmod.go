package strategies

import (
	"encoding/json"
	"fmt"
	"log/slog"

	"dex/backend/dearth/types"
	"dex/backend/platform"

	"resty.dev/v3"
)

const curseForgeGameID = 432

// McmodFilter checks mods by resolving CurseForge fingerprints and querying the Galaxy Square mcmod API.
type McmodFilter struct {
	urls         platform.MirrorUrls
	client       *resty.Client
	galaxyClient *resty.Client
}

func NewMcmodFilter() *McmodFilter {
	return &McmodFilter{
		urls: platform.GetMirrorUrls(),
		client: resty.New().
			SetHeader("User-Agent", "DeEarthX").
			SetHeader("x-api-key", platform.CurseForgeAPIKey).
			SetHeader("Content-Type", "application/json").
			SetHeader("Accept", "application/json").
			SetTimeout(15),
		galaxyClient: resty.New().
			SetHeader("User-Agent", "DeEarthX").
			SetHeader("Content-Type", "application/json").
			SetTimeout(15),
	}
}

func (mf *McmodFilter) Name() string { return "McmodFilter" }

func (mf *McmodFilter) Filter(files []types.FileInfo) ([]string, error) {
	projectIdMap := mf.resolveProjectIds(files)
	if len(projectIdMap) == 0 {
		return nil, nil
	}

	uniqueProjectIds := make(map[int]bool)
	for _, id := range projectIdMap {
		uniqueProjectIds[id] = true
	}
	idList := make([]int, 0, len(uniqueProjectIds))
	for id := range uniqueProjectIds {
		idList = append(idList, id)
	}

	mcmodResults := mf.queryMcmodApi(idList)

	var clientMods []string
	for filename, projectId := range projectIdMap {
		result, ok := mcmodResults[projectId]
		if ok && result.ClientSide == "required" && result.ServerSide == "unsupported" {
			clientMods = append(clientMods, filename)
		}
	}

	return clientMods, nil
}

func (mf *McmodFilter) resolveProjectIds(files []types.FileInfo) map[string]int {
	projectIdMap := make(map[string]int)
	fingerprintMap := make(map[uint32]string)
	var fingerprints []uint32

	for _, file := range files {
		if file.Murmur2 != 0 {
			fingerprints = append(fingerprints, file.Murmur2)
			fingerprintMap[file.Murmur2] = file.Filename
		}
	}

	if len(fingerprints) == 0 {
		return projectIdMap
	}

	cfMap := mf.queryCurseForgeFingerprint(fingerprints)
	for fp, projectId := range cfMap {
		if filename, ok := fingerprintMap[fp]; ok {
			projectIdMap[filename] = projectId
		}
	}

	return projectIdMap
}

func (mf *McmodFilter) queryCurseForgeFingerprint(fingerprints []uint32) map[uint32]int {
	result := make(map[uint32]int)
	if len(fingerprints) == 0 {
		return result
	}

	resp, err := mf.client.R().
		SetBody(map[string]any{"fingerprints": fingerprints}).
		Post(mf.urls.CurseForgeURL + "/v1/fingerprints/" + fmt.Sprintf("%d", curseForgeGameID))
	if err != nil {
		slog.Error("Mcmod filter: CurseForge fingerprint API error", "error", err)
		return result
	}

	var response struct {
		Data struct {
			ExactMatches []struct {
				File struct {
					FileFingerprint uint32 `json:"fileFingerprint"`
					ModID           int    `json:"modId"`
				} `json:"file"`
			} `json:"exactMatches"`
		} `json:"data"`
	}
	if err := json.Unmarshal(resp.Bytes(), &response); err != nil {
		return result
	}

	for _, match := range response.Data.ExactMatches {
		if match.File.FileFingerprint != 0 && match.File.ModID != 0 {
			result[match.File.FileFingerprint] = match.File.ModID
		}
	}

	return result
}

type mcmodResult struct {
	ClientSide string
	ServerSide string
}

func (mf *McmodFilter) queryMcmodApi(projectIds []int) map[int]mcmodResult {
	result := make(map[int]mcmodResult)
	if len(projectIds) == 0 {
		return result
	}

	resp, err := mf.galaxyClient.R().
		SetBody(map[string]any{"curseforge_ids": projectIds}).
		Post("https://galaxy.tianpao.top/mcmod/query")
	if err != nil {
		slog.Error("Mcmod filter: Galaxy Square mcmod API error", "error", err)
		return result
	}

	var response []struct {
		CurseforgeIDs []int  `json:"curseforgeIds"`
		CurseforgeID  int    `json:"curseforge_id"`
		ID            int    `json:"id"`
		ClientSide    string `json:"clientSide"`
		ServerSide    string `json:"serverSide"`
	}
	if err := json.Unmarshal(resp.Bytes(), &response); err != nil {
		return result
	}

	for _, item := range response {
		cfID := 0
		if len(item.CurseforgeIDs) > 0 {
			cfID = item.CurseforgeIDs[0]
		} else if item.CurseforgeID != 0 {
			cfID = item.CurseforgeID
		} else {
			cfID = item.ID
		}
		if cfID != 0 {
			cs := item.ClientSide
			if cs == "" {
				cs = "required"
			}
			ss := item.ServerSide
			if ss == "" {
				ss = "required"
			}
			result[cfID] = mcmodResult{ClientSide: cs, ServerSide: ss}
		}
	}

	return result
}
