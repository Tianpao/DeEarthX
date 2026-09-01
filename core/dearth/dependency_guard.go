package dearth

import (
	"encoding/json"
	"path/filepath"
	"strings"

	"deearthx/core/util"
)

// ExcludeRequiredDependencies removes jars from the client-mod list when they are
// still required as dependencies by remaining server-side mods (avoids Mixin false positives).
func ExcludeRequiredDependencies(clientMods []string, files []FileInfo) []string {
	clientSet := make(map[string]bool, len(clientMods))
	for _, name := range clientMods {
		clientSet[name] = true
	}

	fileByName := make(map[string]FileInfo, len(files))
	for _, f := range files {
		fileByName[f.Filename] = f
	}

	modIDToFile := make(map[string]string)
	for _, f := range files {
		for _, modID := range extractModIDs(f) {
			modIDToFile[modID] = f.Filename
		}
	}

	requiredIDs := make(map[string]bool)
	for _, f := range files {
		if clientSet[f.Filename] {
			continue
		}
		for _, depID := range extractDependencies(f) {
			requiredIDs[depID] = true
		}
	}

	kept := make([]string, 0, len(clientMods))
	restored := 0
	for _, filename := range clientMods {
		file, ok := fileByName[filename]
		if !ok {
			kept = append(kept, filename)
			continue
		}
		modIDs := extractModIDs(file)
		isRequired := false
		for _, id := range modIDs {
			if requiredIDs[id] {
				isRequired = true
				break
			}
		}
		if isRequired {
			util.Logger.Debug("保留服务端依赖模组，跳过筛选",
				"file", filepath.Base(filename),
				"modIds", modIDs)
			restored++
			continue
		}
		kept = append(kept, filename)
	}

	if restored > 0 {
		util.Logger.Debug("依赖保护已还原模组", "数量", restored)
	}
	return kept
}

func extractModIDs(file FileInfo) []string {
	ids := []string{}
	for _, info := range file.Infos {
		parsed := parseInfoData(info.Data)
		if parsed == nil {
			continue
		}

		// Forge / NeoForge (TOML converted to JSON)
		if mods, ok := parsed["mods"].([]interface{}); ok {
			for _, mod := range mods {
				if m, ok := mod.(map[string]interface{}); ok {
					if id, ok := m["modId"].(string); ok && id != "" {
						ids = append(ids, id)
					}
				}
			}
		}

		// Fabric
		if strings.HasSuffix(info.Name, "fabric.mod.json") {
			if id, ok := parsed["id"].(string); ok && id != "" {
				ids = append(ids, id)
			}
		}
	}
	return ids
}

func extractDependencies(file FileInfo) []string {
	deps := []string{}
	for _, info := range file.Infos {
		parsed := parseInfoData(info.Data)
		if parsed == nil {
			continue
		}

		// Forge / NeoForge dependencies.<modId> = [{ modId, type }]
		if depMap, ok := parsed["dependencies"].(map[string]interface{}); ok {
			for _, entries := range depMap {
				list, ok := entries.([]interface{})
				if !ok {
					continue
				}
				for _, entry := range list {
					m, ok := entry.(map[string]interface{})
					if !ok {
						continue
					}
					modID, _ := m["modId"].(string)
					depType, _ := m["type"].(string)
					if modID != "" && depType != "optional" {
						deps = append(deps, modID)
					}
				}
			}
		}

		// Fabric depends: { "modid": "version" }
		if strings.HasSuffix(info.Name, "fabric.mod.json") {
			if depMap, ok := parsed["depends"].(map[string]interface{}); ok {
				for modID := range depMap {
					if isFabricBuiltinDep(modID) {
						continue
					}
					deps = append(deps, modID)
				}
			}
		}
	}
	return deps
}

func isFabricBuiltinDep(modID string) bool {
	switch modID {
	case "minecraft", "java", "fabricloader", "fabric-loader":
		return true
	default:
		return false
	}
}

func parseInfoData(data string) map[string]interface{} {
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(data), &parsed); err != nil {
		return nil
	}
	return parsed
}
