package strategies

import (
	"encoding/json"
	"strconv"

	"resty.dev/v3"

	"deearthx/core/download"
	"deearthx/core/util"
)

// McmodFilter checks mods by CurseForge fingerprint and Mcmod.cn API
type McmodFilter struct {
	urls   download.MirrorUrls
	apiKey string
	client *resty.Client
}

// NewMcmodFilter creates a new McmodFilter
func NewMcmodFilter() *McmodFilter {
	return &McmodFilter{
		urls:   download.GetMirrorUrls(),
		apiKey: "$2a$10$ydk0TLDG/Gc6uPMdz7mad.iisj2TaMDytVcIW4gcVP231VKngLBKy",
		client: resty.New(),
	}
}

// Name returns the strategy name
func (mf *McmodFilter) Name() string {
	return "McmodFilter"
}

// Filter returns client-side mods identified by CurseForge/Mcmod
func (mf *McmodFilter) Filter(files []FileInfo) ([]string, error) {
	// Build fingerprint list
	fingerprints := []uint32{}
	fingerprintToFilename := make(map[uint32]string)

	for _, file := range files {
		if file.Murmur2 != nil {
			fp := *file.Murmur2
			fingerprints = append(fingerprints, fp)
			fingerprintToFilename[fp] = file.Filename
		}
	}

	if len(fingerprints) == 0 {
		return []string{}, nil
	}

	util.Logger.Debug("Checking mods with CurseForge fingerprint", "count", len(fingerprints))

	// Query CurseForge API for fingerprints
	resp, err := mf.client.R().
		SetHeader("User-Agent", "DeEarthX").
		SetHeader("x-api-key", mf.apiKey).
		SetHeader("Content-Type", "application/json").
		SetBody(map[string]interface{}{
			"fingerprints": fingerprints,
		}).
		Post("https://api.curseforge.com/v1/fingerprints")

	if err != nil {
		util.Logger.Error("CurseForge fingerprint check failed: " + err.Error())
		return nil, err
	}

	if resp.StatusCode() >= 400 {
		util.Logger.Error("CurseForge API error: HTTP " + resp.Status())
		return []string{}, nil
	}

	// Parse response - structure depends on exact API response
	var result struct {
		Data struct {
			ExactMatches []struct {
				ID       uint32 `json:"id"`
				FileID   int    `json:"fileId"`
				FileName string `json:"fileName"`
				Side     string `json:"releaseType"`
			} `json:"exactMatches"`
		} `json:"data"`
	}

	if err := json.Unmarshal(resp.Bytes(), &result); err != nil {
		return nil, err
	}

	clientMods := []string{}

	// Process exact matches
	for _, match := range result.Data.ExactMatches {
		filename, exists := fingerprintToFilename[match.ID]
		if !exists {
			continue
		}

		util.Logger.Debug("CurseForge fingerprint match",
			"filename", filename,
			"fileId", match.FileID,
			"side", match.Side)
	}

	util.Logger.Debug("Mcmod check complete", "clientMods", len(clientMods))
	return clientMods, nil
}

// Helper functions shared across strategies
func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += sep + strs[i]
	}
	return result
}

func formatUint(n uint32) string {
	return strconv.FormatUint(uint64(n), 10)
}