package dearth

import (
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
// 3. Move client-side mods to the rubbish directory
func (mfs *ModFilterService) Filter() error {
	fmt.Println("Starting mod filter workflow...")

	files, err := mfs.extractor.ExtractFilesInfo()
	if err != nil {
		return fmt.Errorf("failed to extract file info: %w", err)
	}
	if len(files) == 0 {
		fmt.Println("No jar files found, skipping filter")
		return nil
	}

	clientMods, err := RunFilterStrategies(files, mfs.config)
	if err != nil {
		return fmt.Errorf("failed to identify client-side mods: %w", err)
	}
	if len(clientMods) == 0 {
		fmt.Println("No client-side mods identified")
		return nil
	}

	fmt.Printf("Identified %d client-side mods\n", len(clientMods))

	result := mfs.operator.MoveClientSideMods(clientMods)
	fmt.Printf("Mod filter complete: moved %d, skipped %d, errors %d\n",
		result.Success, result.Skipped, result.Error)

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
