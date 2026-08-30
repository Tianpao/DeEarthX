package services

import (
	"fmt"
	"path/filepath"

	"deearthx/core/dearth"
	"deearthx/core/dex"
	"deearthx/core/util"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ModCheckService handles mod checking operations
type ModCheckService struct{}

// NewModCheckService creates a new ModCheckService
func NewModCheckService() *ModCheckService {
	return &ModCheckService{}
}

// StartModCheck scans JAR files in a folder, runs the full filter strategy chain,
// and moves identified client-side mods to .rubbish/<bundleName>.
func (s *ModCheckService) StartModCheck(folderPath, bundleName string) {
	go func() {
		app := application.Get()
		defer func() {
			if r := recover(); r != nil {
				util.Logger.Error(fmt.Sprintf("ModCheck panic: %v", r))
			}
		}()

		extractor := dearth.NewFileExtractor(folderPath)
		fileInfos, err := extractor.ExtractFilesInfo()
		if err != nil {
			app.Event.Emit(dex.EventModCheckError, map[string]interface{}{
				"error": fmt.Sprintf("Failed to scan folder: %v", err),
			})
			return
		}

		totalMods := len(fileInfos)
		app.Event.Emit(dex.EventModCheckStart, map[string]interface{}{
			"totalMods":  totalMods,
			"bundleName": bundleName,
		})

		app.Event.Emit(dex.EventModCheckProgress, map[string]interface{}{
			"current": 0,
			"total":   totalMods,
			"modName": "正在识别客户端模组...",
		})

		// Match TS ModCheckService DEFAULT_CONFIG — enable all strategies
		filterConfig := dearth.FilterConfig{
			Hashes:   true,
			Dexpub:   true,
			Mixins:   true,
			Modrinth: true,
			Mcmod:    true,
		}

		clientMods, err := dearth.RunFilterStrategies(fileInfos, filterConfig, nil)
		if err != nil {
			app.Event.Emit(dex.EventModCheckError, map[string]interface{}{
				"error": fmt.Sprintf("Filter strategies failed: %v", err),
			})
			return
		}

		clientSet := make(map[string]bool, len(clientMods))
		for _, name := range clientMods {
			clientSet[name] = true
		}

		results := make([]dearth.ModCheckResult, 0, totalMods)
		for i, info := range fileInfos {
			app.Event.Emit(dex.EventModCheckProgress, map[string]interface{}{
				"current": i + 1,
				"total":   totalMods,
				"modName": filepath.Base(info.Filename),
			})

			isClient := clientSet[info.Filename]
			result := dearth.ModCheckResult{
				Filename:   filepath.Base(info.Filename),
				FilePath:   info.Filename,
				ClientSide: dearth.ModSideUnknown,
				ServerSide: dearth.ModSideUnknown,
				Source:     "none",
				Checked:    false,
				AllResults: []dearth.SingleCheckResult{},
			}

			if isClient {
				result.ClientSide = dearth.ModSideRequired
				result.ServerSide = dearth.ModSideUnsupported
				result.Source = "Multiple"
				result.Checked = true
				result.AllResults = []dearth.SingleCheckResult{{
					Source:     "Multiple",
					ClientSide: dearth.ModSideRequired,
					ServerSide: dearth.ModSideUnsupported,
					Checked:    true,
				}}
			}

			results = append(results, result)
		}

		if len(clientMods) > 0 {
			movePath := filepath.Join(util.GetAppDir(), ".rubbish", bundleName)
			op := dearth.NewFileOperator(movePath)
			if _, err := op.MoveClientSideMods(clientMods); err != nil {
				util.Logger.Error("ModCheck failed to move client mods: " + err.Error())
			}
		}

		util.Logger.Info("ModCheck complete",
			"total", len(results),
			"filtered", len(clientMods),
		)

		app.Event.Emit(dex.EventModCheckComplete, map[string]interface{}{
			"results":       results,
			"filteredCount": len(clientMods),
		})
	}()
}
