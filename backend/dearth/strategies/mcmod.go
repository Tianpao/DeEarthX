package strategies

import (
	"encoding/json"
	"log/slog"
	"time"

	"dex/backend/dearth/types"

	"resty.dev/v3"
)

// McmodFilter checks mods by resolving CurseForge fingerprints into project IDs,
// then querying the Galaxy Square mcmod API for side compatibility info.
type McmodFilter struct {
	galaxyClient *resty.Client
	// fingerprints optionally holds a fingerprint map resolved once by the runner
	// and shared with the CurseForge filter, so the slow API is hit only once.
	fingerprints map[uint32]FingerprintMatch
}

func NewMcmodFilter() *McmodFilter {
	return &McmodFilter{
		galaxyClient: resty.New().
			SetHeader("User-Agent", "DeEarthX").
			SetHeader("Content-Type", "application/json").
			SetTimeout(60 * time.Second),
	}
}

func (mf *McmodFilter) Name() string { return "McmodFilter" }

// SetSharedFingerprints supplies a pre-resolved fingerprint map so the filter
// skips the CurseForge network call. The map must cover a superset of the files
// passed to Filter.
func (mf *McmodFilter) SetSharedFingerprints(m map[uint32]FingerprintMatch) {
	mf.fingerprints = m
}

func (mf *McmodFilter) Filter(files []types.FileInfo) ([]string, error) {
	verdicts := mf.Verdicts(files)
	var clientMods []string
	for f, v := range verdicts {
		if v == types.VerdictClient {
			clientMods = append(clientMods, f)
		}
	}
	return clientMods, nil
}

// Verdicts returns, per file, how the Mcmod API classifies it: VerdictClient
// for client-only, VerdictServer for known dual/server-capable, or absent when
// the mod has no CurseForge-identifiable project or the API has no entry.
func (mf *McmodFilter) Verdicts(files []types.FileInfo) map[string]types.SideVerdict {
	result := make(map[string]types.SideVerdict)

	projectIdMap := mf.resolveProjectIds(files)
	if len(projectIdMap) == 0 {
		return result
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

	for filename, projectId := range projectIdMap {
		resultInfo, ok := mcmodResults[projectId]
		if !ok {
			continue // unknown
		}
		if resultInfo.ClientSide == "required" && resultInfo.ServerSide == "unsupported" {
			result[filename] = types.VerdictClient
		} else {
			result[filename] = types.VerdictServer
		}
	}

	return result
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

	matches := mf.fingerprints
	if matches == nil {
		slog.Info("McmodFilter: resolving fingerprints")
		matches = ResolveFingerprints(fingerprints)
	}

	for fp, match := range matches {
		if match.ModID != 0 {
			if filename, ok := fingerprintMap[fp]; ok {
				projectIdMap[filename] = match.ModID
			}
		}
	}

	return projectIdMap
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
