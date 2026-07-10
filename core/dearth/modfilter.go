package dearth

import (
	"time"

	"deearthx/core/util"
)

// ModFilterService orchestrates mod filtering
type ModFilterService struct {
	extractor  *FileExtractor
	operator   *FileOperator
	config     FilterConfig
	progress   ProgressCallback
}

// NewModFilterService creates a new ModFilterService
func NewModFilterService(modsPath, movePath string, config FilterConfig, progress ProgressCallback) *ModFilterService {
	return &ModFilterService{
		extractor: NewFileExtractor(modsPath),
		operator:  NewFileOperator(movePath),
		config:    config,
		progress:  progress,
	}
}

// Filter executes the mod filtering pipeline
func (mfs *ModFilterService) Filter() error {
	util.Logger.Info("Starting mod filtering pipeline")
	startTime := time.Now()

	// Extract file information
	files, err := mfs.extractor.ExtractFilesInfo()
	if err != nil {
		return err
	}

	if mfs.progress != nil {
		mfs.progress(0, len(files), "Extracting file info")
	}

	// Run filter strategies
	clientMods, err := RunFilterStrategies(files, mfs.config, mfs.progress)
	if err != nil {
		return err
	}

	// Move client mods
	result, err := mfs.operator.MoveClientSideMods(clientMods)
	if err != nil {
		return err
	}

	duration := time.Since(startTime)

	util.Logger.Info("Mod filtering complete",
		"clientMods", len(clientMods),
		"moved", result.Success,
		"skipped", result.Skipped,
		"errors", result.Error,
		"duration", duration)

	return nil
}