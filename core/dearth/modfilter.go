package dearth

import (
	"time"

	"deearthx/core/util"
)

// ProgressCallback is called during filter progress (current, total, name)
type ProgressCallback func(current int, total int, name string)

// ModFilterService orchestrates mod filtering
type ModFilterService struct {
	extractor  *FileExtractor
	operator   *FileOperator
	config     FilterConfig
	progress   ProgressCallback
	OnStart    func(totalMods int)
	OnComplete func(clientMods, success int, durationMs int64)
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

	files, err := mfs.extractor.ExtractFilesInfo()
	if err != nil {
		return err
	}

	if mfs.OnStart != nil {
		mfs.OnStart(len(files))
	}

	if mfs.progress != nil {
		mfs.progress(0, len(files), "Extracting file info")
	}

	clientMods, err := RunFilterStrategies(files, mfs.config, mfs.progress)
	if err != nil {
		return err
	}

	result, err := mfs.operator.MoveClientSideMods(clientMods)
	if err != nil {
		return err
	}

	duration := time.Since(startTime)

	if mfs.OnComplete != nil {
		mfs.OnComplete(len(clientMods), result.Success, duration.Milliseconds())
	}

	util.Logger.Info("Mod filtering complete",
		"clientMods", len(clientMods),
		"moved", result.Success,
		"skipped", result.Skipped,
		"errors", result.Error,
		"duration", duration)

	return nil
}
