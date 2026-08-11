package strategies

import (
	"encoding/json"
	"fmt"
	"log/slog"

	"dex/backend/dearth/types"
	"dex/backend/platform"

	"resty.dev/v3"
)

// CurseForgeFilter checks mods by reading the gameVersions of the latest file
// from CurseForge's fingerprints API. A mod whose latest file is marked Client
// but not Server is considered a client-only mod.
type CurseForgeFilter struct {
	urls   platform.MirrorUrls
	client *resty.Client
}

func NewCurseForgeFilter() *CurseForgeFilter {
	return &CurseForgeFilter{
		urls: platform.GetMirrorUrls(),
		client: resty.New().
			SetHeader("User-Agent", "DeEarthX").
			SetHeader("x-api-key", platform.CurseForgeAPIKey).
			SetHeader("Content-Type", "application/json").
			SetHeader("Accept", "application/json").
			SetTimeout(15),
	}
}

func (cf *CurseForgeFilter) Name() string { return "CurseForgeFilter" }

func (cf *CurseForgeFilter) Filter(files []types.FileInfo) ([]string, error) {
	fingerprintMap := make(map[uint32]string)
	var fingerprints []uint32
	for _, file := range files {
		if file.Murmur2 != 0 {
			fingerprints = append(fingerprints, file.Murmur2)
			fingerprintMap[file.Murmur2] = file.Filename
		}
	}

	if len(fingerprints) == 0 {
		return nil, nil
	}

	resp, err := cf.client.R().
		SetBody(map[string]any{"fingerprints": fingerprints}).
		Post(cf.urls.CurseForgeURL + "/v1/fingerprints/" + fmt.Sprintf("%d", curseForgeGameID))
	if err != nil {
		slog.Error("CurseForge filter: fingerprint API error", "error", err)
		return nil, nil
	}

	var response struct {
		Data struct {
			ExactMatches []struct {
				File struct {
					FileFingerprint uint32 `json:"fileFingerprint"`
				} `json:"file"`
				LatestFiles []struct {
					GameVersions []string `json:"gameVersions"`
				} `json:"latestFiles"`
			} `json:"exactMatches"`
		} `json:"data"`
	}
	if err := json.Unmarshal(resp.Bytes(), &response); err != nil {
		slog.Error("CurseForge filter: failed to parse response", "error", err)
		return nil, nil
	}

	var clientMods []string
	for _, match := range response.Data.ExactMatches {
		if len(match.LatestFiles) == 0 {
			continue
		}
		versions := match.LatestFiles[0].GameVersions
		if hasClientOnly(versions) {
			if filename, ok := fingerprintMap[match.File.FileFingerprint]; ok {
				clientMods = append(clientMods, filename)
			}
		}
	}

	return clientMods, nil
}

// hasClientOnly reports whether the gameVersions list marks a mod as client-only,
// i.e. it includes "Client" but not "Server".
func hasClientOnly(gameVersions []string) bool {
	var hasClient, hasServer bool
	for _, v := range gameVersions {
		if v == "Client" {
			hasClient = true
		} else if v == "Server" {
			hasServer = true
		}
	}
	return hasClient && !hasServer
}