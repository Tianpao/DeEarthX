package dearth

import (
	"log/slog"
	"fmt"

	"dex/backend/dearth/types"
)

// ModFilterService is the main entry point for mod filtering.
type ModFilterService struct {
	extractor *FileExtractor
	operator  *FileOperator
	config    types.FilterConfig
}

func NewModFilterService(modsPath, movePath string, config types.FilterConfig) *ModFilterService {
	return &ModFilterService{
		extractor: NewFileExtractor(modsPath),
		operator:  NewFileOperator(movePath),
		config:    config,
	}
}

// Filter runs the full mod filtering workflow:
// 1. Extract file info from all jars
// 2. Run filter strategies to identify client-side mods
// 3. Move client-side mods to the .clientmod directory
func (mfs *ModFilterService) Filter() error {
	slog.Info("Starting mod filter workflow")

	files, err := mfs.extractor.ExtractFilesInfo()
	if err != nil {
		return fmt.Errorf("failed to extract file info: %w", err)
	}
	if len(files) == 0 {
		slog.Info("No jar files found, skipping filter")
		return nil
	}

	clientMods, err := RunFilterStrategies(files, mfs.config)
	if err != nil {
		return fmt.Errorf("failed to identify client-side mods: %w", err)
	}
	if len(clientMods) == 0 {
		slog.Info("No client-side mods identified")
		return nil
	}

	slog.Info("Identified client-side mods", "count", len(clientMods))

	result := mfs.operator.MoveClientSideMods(clientMods)
		slog.Info("Mod filter complete", "moved", result.Success, "skipped", result.Skipped, "errors", result.Error)

	return nil
}

// IdentifyOnly runs the filter strategies without moving files (preview/check-only).
func (mfs *ModFilterService) IdentifyOnly() ([]string, error) {
	files, err := mfs.extractor.ExtractFilesInfo()
	if err != nil {
		return nil, fmt.Errorf("failed to extract file info: %w", err)
	}
	return RunFilterStrategies(files, mfs.config)
}
