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
		util.Logger.Debug("没有需要移动的客户端模组")
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
			util.Logger.Warn("文件不存在，跳过: " + absoluteSourcePath)
			result.Skipped++
			continue
		}

		filename := filepath.Base(absoluteSourcePath)
		targetPath := filepath.Join(absoluteMovePath, filename)

		util.Logger.Debug("正在移动文件: " + filename)

		// Copy file to target
		err := util.CopyFile(absoluteSourcePath, targetPath)
		if err != nil {
			util.Logger.Error("复制文件失败: " + err.Error())
			result.Error++
			continue
		}

		// Delete original file
		err = os.Remove(absoluteSourcePath)
		if err != nil {
			util.Logger.Error("删除原文件失败: " + err.Error())
			result.Error++
			continue
		}

		result.Success++
	}

	util.Logger.Info("文件移动完成",
		"总数", len(clientMods),
		"成功", result.Success,
		"失败", result.Error,
		"跳过", result.Skipped)

	return result, nil
}