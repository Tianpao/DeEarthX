package dearth

import (
	"log/slog"
	"io"
	"os"
	"path/filepath"

	"dex/backend/dearth/types"
)

// FileOperator handles moving identified client-side mod files.
type FileOperator struct {
	movePath string
}

func NewFileOperator(movePath string) *FileOperator {
	if !filepath.IsAbs(movePath) {
		abs, _ := filepath.Abs(movePath)
		movePath = abs
	}
	return &FileOperator{movePath: movePath}
}

// MoveClientSideMods moves client-side mod files to the rubbish directory.
// Uses copy+delete to handle cross-device moves.
func (fo *FileOperator) MoveClientSideMods(clientMods []string) types.MoveResult {
	result := types.MoveResult{}
	if len(clientMods) == 0 {
		return result
	}

	if err := os.MkdirAll(fo.movePath, 0o755); err != nil {
		slog.Error("failed to create move directory", "path", fo.movePath, "error", err)
		result.Error = len(clientMods)
		return result
	}

	for _, sourcePath := range clientMods {
		absSource := sourcePath
		if !filepath.IsAbs(absSource) {
			absSource, _ = filepath.Abs(absSource)
		}
		if _, err := os.Stat(absSource); os.IsNotExist(err) {
			result.Skipped++
			continue
		}
		targetPath := filepath.Join(fo.movePath, filepath.Base(absSource))
		if err := copyFile(absSource, targetPath); err != nil {
			slog.Error("failed to copy file", "source", absSource, "error", err)
			result.Error++
			continue
		}
		if err := os.Remove(absSource); err != nil {
			slog.Error("failed to remove original file", "source", absSource, "error", err)
			result.Error++
			continue
		}
		result.Success++
	}

	return result
}

func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}
