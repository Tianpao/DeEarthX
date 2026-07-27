package strategies

import (
	"encoding/json"
	"log/slog"
	"sync"

	"dex/backend/dearth/types"

	"resty.dev/v3"
)

// DexpubFilter checks mods against the Galaxy Square API.
type DexpubFilter struct {
	client   *resty.Client
	mu       sync.Mutex
	cached   *types.DexpubCheckResult
	cacheKey string
}

func NewDexpubFilter() *DexpubFilter {
	return &DexpubFilter{
		client: resty.New().
			SetBaseURL("https://galaxy.tianpao.top/").
			SetHeader("User-Agent", "DeEarthX"),
	}
}

func (df *DexpubFilter) Name() string { return "DexpubFilter" }

func (df *DexpubFilter) Filter(files []types.FileInfo) ([]string, error) {
	result, err := df.checkDexpub(files)
	if err != nil {
		return nil, err
	}
	return result.ClientMods, nil
}

// GetServerMods returns the server-side mods identified by Dexpub.
func (df *DexpubFilter) GetServerMods(files []types.FileInfo) ([]string, error) {
	result, err := df.checkDexpub(files)
	if err != nil {
		return nil, err
	}
	return result.ServerMods, nil
}

func (df *DexpubFilter) checkDexpub(files []types.FileInfo) (*types.DexpubCheckResult, error) {
	cacheKey := ""
	for _, f := range files {
		cacheKey += f.Filename + ","
	}

	df.mu.Lock()
	if df.cached != nil && df.cacheKey == cacheKey {
		result := df.cached
		df.mu.Unlock()
		return result, nil
	}
	df.mu.Unlock()

	clientMods := []string{}
	serverMods := []string{}
	modIDs := []string{}
	modIDToFilename := make(map[string]string)

	for _, file := range files {
		for _, info := range file.Infos {
			var config map[string]any
			if err := json.Unmarshal([]byte(info.Data), &config); err != nil {
				continue
			}
			if id, ok := config["id"].(string); ok && id != "" {
				modIDs = append(modIDs, id)
				modIDToFilename[id] = file.Filename
			} else if mods, ok := config["mods"].([]any); ok && len(mods) > 0 {
				if mod, ok := mods[0].(map[string]any); ok {
					if modID, ok := mod["modId"].(string); ok && modID != "" {
						modIDs = append(modIDs, modID)
						modIDToFilename[modID] = file.Filename
					}
				}
			}
		}
	}

	if len(modIDs) == 0 {
		result := &types.DexpubCheckResult{ServerMods: serverMods, ClientMods: clientMods}
		df.mu.Lock()
		df.cached = result
		df.cacheKey = cacheKey
		df.mu.Unlock()
		return result, nil
	}

	resp, err := df.client.R().
		SetBody(map[string]any{"modids": modIDs}).
		Post("mod/check")
	if err != nil {
		slog.Error("Dexpub API error", "error", err)
		return &types.DexpubCheckResult{ServerMods: serverMods, ClientMods: clientMods}, nil
	}

	var modIDToIsClient map[string]bool
	if err := json.Unmarshal(resp.Bytes(), &modIDToIsClient); err != nil {
		slog.Error("Dexpub API response parse error", "error", err)
		return &types.DexpubCheckResult{ServerMods: serverMods, ClientMods: clientMods}, nil
	}

	for modID, isClient := range modIDToIsClient {
		filename, ok := modIDToFilename[modID]
		if !ok {
			continue
		}
		if isClient {
			clientMods = append(clientMods, filename)
		} else {
			serverMods = append(serverMods, filename)
		}
	}

	result := &types.DexpubCheckResult{ServerMods: serverMods, ClientMods: clientMods}
	df.mu.Lock()
	df.cached = result
	df.cacheKey = cacheKey
	df.mu.Unlock()
	return result, nil
}
