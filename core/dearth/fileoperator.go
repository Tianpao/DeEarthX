package dearth

import (
	"os"
	"path/filepath"

	"deearthx/core/util"
)

// FileOperator moves identified client-side mods
type FileOperator struct {
	movePath string
}

// NewFileOperator creates a new FileOperator
func NewFileOperator(movePath string) *FileOperator {
	return &FileOperator{movePath: movePath}
}

// MoveResult contains the result of file movement
type MoveResult struct {
	Success int
	Error   int
	Skipped int
}

// MoveClientSideMods moves client-side mods to the rubbish directory
func (fo *FileOperator) MoveClientSideMods(clientMods []string) (*MoveResult, error) {
	if len(clientMods) == 0 {
		util.Logger.Info("No client-side mods to move")
		return &MoveResult{}, nil
	}

	absoluteMovePath := fo.movePath
	if !filepath.IsAbs(absoluteMovePath) {
		absPath, err := filepath.Abs(absoluteMovePath)
		if err != nil {
			absoluteMovePath = fo.movePath
		} else {
			absoluteMovePath = absPath
		}
	}

	// Ensure target directory exists
	os.MkdirAll(absoluteMovePath, 0755)

	result := &MoveResult{}

	for _, sourcePath := range clientMods {
		absoluteSourcePath := sourcePath
		if !filepath.IsAbs(absoluteSourcePath) {
			absPath, err := filepath.Abs(sourcePath)
			if err != nil {
				absoluteSourcePath = sourcePath
			} else {
				absoluteSourcePath = absPath
			}
		}

		// Check if file exists
		if _, err := os.Stat(absoluteSourcePath); err != nil {
			util.Logger.Warn("File does not exist, skipping: " + absoluteSourcePath)
			result.Skipped++
			continue
		}

		filename := filepath.Base(absoluteSourcePath)
		targetPath := filepath.Join(absoluteMovePath, filename)

		util.Logger.Info("Moving file: " + filename)

		// Copy file to target
		err := util.CopyFile(absoluteSourcePath, targetPath)
		if err != nil {
			util.Logger.Error("Failed to copy file: " + err.Error())
			result.Error++
			continue
		}

		// Delete original file
		err = os.Remove(absoluteSourcePath)
		if err != nil {
			util.Logger.Error("Failed to delete original file: " + err.Error())
			result.Error++
			continue
		}

		result.Success++
	}

	util.Logger.Info("File movement complete",
		"total", len(clientMods),
		"success", result.Success,
		"error", result.Error,
		"skipped", result.Skipped)

	return result, nil
}