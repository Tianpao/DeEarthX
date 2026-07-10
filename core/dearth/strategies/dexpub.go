package strategies

import (
	"encoding/json"
	"sync"

	"resty.dev/v3"

	"deearthx/core/util"
)

// DexpubFilter checks mods against Galaxy Square API
type DexpubFilter struct {
	client      *resty.Client
	cachedFiles []FileInfo
	cachedResult *DexpubCheckResult
	cacheMutex  sync.Mutex
}

// DexpubCheckResult represents Galaxy Square check result
type DexpubCheckResult struct {
	ServerMods []string `json:"serverMods"`
	ClientMods []string `json:"clientMods"`
}

// NewDexpubFilter creates a new DexpubFilter
func NewDexpubFilter() *DexpubFilter {
	return &DexpubFilter{
		client: resty.New().
			SetBaseURL("https://galaxy.tianpao.top/").
			SetHeader("User-Agent", "DeEarthX"),
	}
}

// Name returns the strategy name
func (df *DexpubFilter) Name() string {
	return "DexpubFilter"
}

// Filter returns client-side mods identified by Galaxy Square
func (df *DexpubFilter) Filter(files []FileInfo) ([]string, error) {
	result, err := df.checkDexpub(files)
	if err != nil {
		return nil, err
	}

	util.Logger.Info("Galaxy Square check complete",
		"serverMods", len(result.ServerMods),
		"clientMods", len(result.ClientMods))

	return result.ClientMods, nil
}

// GetServerMods returns server-side mods identified by Galaxy Square
func (df *DexpubFilter) GetServerMods(files []FileInfo) ([]string, error) {
	result, err := df.checkDexpub(files)
	if err != nil {
		return nil, err
	}
	return result.ServerMods, nil
}

func (df *DexpubFilter) checkDexpub(files []FileInfo) (*DexpubCheckResult, error) {
	df.cacheMutex.Lock()
	defer df.cacheMutex.Unlock()

	// Check cache
	if df.cachedFiles != nil && len(df.cachedFiles) == len(files) {
		// Simple comparison - in production should be more thorough
		return df.cachedResult, nil
	}

	clientMods := []string{}
	serverMods := []string{}
	modIDs := []string{}
	modIDToFile := make(map[string]string)

	// Extract mod IDs from info files
	for _, file := range files {
		for _, info := range file.Infos {
			var config map[string]interface{}
			if err := json.Unmarshal([]byte(info.Data), &config); err != nil {
				continue
			}

			if id, ok := config["id"].(string); ok {
				modIDs = append(modIDs, id)
				modIDToFile[id] = file.Filename
			} else if mods, ok := config["mods"].([]interface{}); ok && len(mods) > 0 {
				if modMap, ok := mods[0].(map[string]interface{}); ok {
					if modId, ok := modMap["modId"].(string); ok {
						modIDs = append(modIDs, modId)
						modIDToFile[modId] = file.Filename
					}
				}
			}
		}
	}

	// Query Galaxy Square API
	resp, err := df.client.R().
		SetBody(map[string]interface{}{"modids": modIDs}).
		Post("mod/check")

	if err != nil {
		util.Logger.Error("Dexpub check failed: " + err.Error())
		return &DexpubCheckResult{ClientMods: clientMods, ServerMods: serverMods}, err
	}

	if resp.StatusCode() >= 400 {
		util.Logger.Error("Dexpub API error: HTTP " + resp.Status())
		return &DexpubCheckResult{ClientMods: clientMods, ServerMods: serverMods}, nil
	}

	var result map[string]bool
	if err := json.Unmarshal(resp.Bytes(), &result); err != nil {
		return &DexpubCheckResult{ClientMods: clientMods, ServerMods: serverMods}, err
	}

	// Process results
	for modID, isClientMod := range result {
		filename, exists := modIDToFile[modID]
		if !exists {
			continue
		}

		if isClientMod {
			clientMods = append(clientMods, filename)
		} else {
			serverMods = append(serverMods, filename)
		}
	}

	checkResult := &DexpubCheckResult{
		ClientMods: clientMods,
		ServerMods: serverMods,
	}

	df.cachedFiles = files
	df.cachedResult = checkResult

	return checkResult, nil
}