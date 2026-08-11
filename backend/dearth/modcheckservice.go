package dearth

import (
	"fmt"
	"path/filepath"

	"dex/backend/dearth/types"
	"dex/backend/utils"
)

// ModCheckResult is a single mod's check result returned to the frontend.
type ModCheckResult struct {
	Filename   string   `json:"filename"`
	FilePath   string   `json:"filePath"`
	ClientSide string   `json:"clientSide"`
	ServerSide string   `json:"serverSide"`
	Source     string   `json:"source"`
	Checked    bool     `json:"checked"`
	Errors     []string `json:"errors,omitempty"`
	AllResults []any    `json:"allResults"`
}

// ModCheckService is the Wails service for the "筛选" (mod check) page.
// It scans a mods folder, identifies client-side mods, moves them into a
// .clientmod/<bundleName> folder, and returns per-mod results.
type ModCheckService struct{}

// NewModCheckService creates a new ModCheckService instance.
func NewModCheckService() *ModCheckService {
	return &ModCheckService{}
}

// CheckMods scans folderPath for client-side mods and moves them into
// <folderPath>/.clientmod/. Returns a result for every scanned jar.
func (s *ModCheckService) CheckMods(folderPath string) ([]ModCheckResult, error) {
	if folderPath == "" {
		return nil, fmt.Errorf("文件夹路径不能为空")
	}

	files, err := NewFileExtractor(folderPath).ExtractFilesInfo()
	if err != nil {
		return nil, fmt.Errorf("提取模组信息失败: %w", err)
	}

	config := types.FilterConfig{
		Hashes:     boolConfig("filter.hashes", true),
		Dexpub:     boolConfig("filter.dexpub", true),
		Mixins:     boolConfig("filter.mixins", false),
		Modrinth:   boolConfig("filter.modrinth", true),
		Mcmod:      boolConfig("filter.mcmod", true),
		CurseForge: boolConfig("filter.curseforge", true),
	}

	clientMods, err := RunFilterStrategies(files, config)
	if err != nil {
		return nil, fmt.Errorf("识别客户端模组失败: %w", err)
	}

	// Move identified client-side mods into <folderPath>/.clientmod/
	movePath := filepath.Join(folderPath, ".clientmod")
	NewFileOperator(movePath).MoveClientSideMods(clientMods)

	clientSet := make(map[string]bool, len(clientMods))
	for _, p := range clientMods {
		clientSet[p] = true
	}

	results := make([]ModCheckResult, 0, len(files))
	for _, f := range files {
		r := ModCheckResult{
			Filename:   filepath.Base(f.Filename),
			FilePath:   f.Filename,
			ClientSide: "unknown",
			ServerSide: "required",
			Source:     "local",
			Checked:    true,
			AllResults: []any{},
		}
		if clientSet[f.Filename] {
			r.ClientSide = "required"
			r.ServerSide = "unsupported"
		}
		results = append(results, r)
	}

	return results, nil
}

// boolConfig reads a boolean config value, falling back to a default.
func boolConfig(key string, def bool) bool {
	v := utils.GlobalConfig.GetConfigValue(key)
	if b, ok := v.(bool); ok {
		return b
	}
	return def
}