package services

import (
	"fmt"

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

// StartModCheck scans JAR files in a folder and classifies them
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
			"totalMods": totalMods,
			"bundleName": bundleName,
		})

		results := make([]dearth.ModCheckResult, 0, totalMods)
		filteredCount := 0

		for i, info := range fileInfos {
			app.Event.Emit(dex.EventModCheckProgress, map[string]interface{}{
				"current": i + 1,
				"total":   totalMods,
				"modName": info.Filename,
			})

			result := dearth.ModCheckResult{
				Filename:   info.Filename,
				FilePath:   info.Filename,
				ClientSide: dearth.ModSideUnknown,
				ServerSide: dearth.ModSideUnknown,
				Source:     "",
				Checked:    true,
			}

			if len(info.Mixins) > 0 {
				result.ClientSide = dearth.ModSideRequired
				result.Source = "mixin"
				filteredCount++
			}

			util.Logger.Debug("ModCheck result",
				"file", info.Filename,
				"clientSide", result.ClientSide,
				"serverSide", result.ServerSide,
			)

			results = append(results, result)
		}

		util.Logger.Info("ModCheck complete",
			"total", len(results),
			"filtered", filteredCount,
		)

		app.Event.Emit(dex.EventModCheckComplete, map[string]interface{}{
			"results":       results,
			"filteredCount": filteredCount,
		})
	}()
}
