package dex

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"deearthx/core/config"
	"deearthx/core/dearth"
	"deearthx/core/modloader"
	"deearthx/core/platform"
	"deearthx/core/util"
	"deearthx/core/ziputil"
)

// ProgressEmitter emits progress events
type ProgressEmitter interface {
	EmitUnzip(filename string, total, current int)
	EmitDownload(total, current int, name string)
	EmitChanged()
	EmitFinish(duration int64)
	EmitError(message string)
	EmitInfo(message string)
	EmitServerInstallStart(title, mcVersion, loader, loaderVersion string)
	EmitServerInstallStep(step string, current, total int)
	EmitServerInstallProgress(step string, progress int)
	EmitServerInstallComplete(path string, duration int64)
	EmitFilterModsStart(totalMods int)
	EmitFilterModsProgress(current, total int, name string)
	EmitFilterModsComplete(clientMods, success int, duration int64)
}

// Dex is the main processing pipeline
type Dex struct {
	emitter ProgressEmitter
}

// NewDex creates a new Dex instance
func NewDex(emitter ProgressEmitter) *Dex {
	return &Dex{emitter: emitter}
}

// ProcessModpack processes a modpack buffer
func (d *Dex) ProcessModpack(buffer []byte, filename string, isServerMode bool, template string) error {
	startTime := time.Now()

	util.Logger.Info("开始处理整合包", "filename", filename)

	// Extract mrpack from PCL-style ZIP if needed
	processedBuffer, err := d.extractMrpackFromZip(buffer, filename)
	if err != nil {
		util.Logger.Error("提取 mrpack 失败: " + err.Error())
		return err
	}

	// Process ZIP entries
	zipProcessor, err := d.processZipEntries(processedBuffer)
	if err != nil {
		return err
	}

	// Get manifest info
	contain, info, err := zipProcessor.GetInfo()
	if err != nil {
		d.emitter.EmitError("该整合包似乎不是有效的整合包。")
		return err
	}

	// Determine platform
	plat := platform.WhatPlatform(contain)
	util.Logger.Info("检测到整合包平台", "platform", plat)

	// Get modpack info
	platHandler := platform.Platform(plat)
	if platHandler == nil {
		return fmt.Errorf("unknown platform: %s", plat)
	}

	modpackInfo, err := platHandler.GetInfo(info)
	if err != nil {
		return err
	}

	mpname := d.getModpackName(info)
	unpath := filepath.Join(util.GetAppDir(), "instance", mpname)
	mcVersion := modpackInfo.Minecraft

	util.Logger.Info("整合包信息",
		"name", mpname,
		"minecraft", mcVersion,
		"loader", modpackInfo.Loader,
		"loaderVersion", modpackInfo.LoaderVersion)

	// Run parallel tasks (unzip + download)
	err = d.parallelTasks(zipProcessor, plat, info, unpath)
	if err != nil {
		return err
	}

	d.emitter.EmitChanged()

	// Filter mods
	err = d.filterMods(unpath, mpname, mcVersion)
	if err != nil {
		return err
	}

	d.emitter.EmitChanged()

	// Install mod loader
	err = d.installModLoader(modpackInfo, unpath, isServerMode, template)
	if err != nil {
		return err
	}

	// Complete task
	duration := time.Since(startTime).Milliseconds()
	d.completeTask(startTime, unpath, mpname, isServerMode)

	util.Logger.Info("任务完成", "duration", duration)
	return nil
}

// ResumeFromPath continues a previous task: skip unzip, re-download missing mods, then filter + install.
func (d *Dex) ResumeFromPath(filePath string, isServerMode bool, template string) error {
	startTime := time.Now()
	util.Logger.Info("从路径断点续传", "path", filePath)

	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	filename := filepath.Base(filePath)
	processedBuffer, err := d.extractMrpackFromZip(data, filename)
	if err != nil {
		return err
	}

	zipProcessor, err := d.processZipEntries(processedBuffer)
	if err != nil {
		return err
	}

	contain, info, err := zipProcessor.GetInfo()
	if err != nil {
		d.emitter.EmitError("该整合包似乎不是有效的整合包。")
		return err
	}

	plat := platform.WhatPlatform(contain)
	platHandler := platform.Platform(plat)
	if platHandler == nil {
		return fmt.Errorf("unknown platform: %s", plat)
	}

	modpackInfo, err := platHandler.GetInfo(info)
	if err != nil {
		return err
	}

	mpname := d.getModpackName(info)
	unpath := filepath.Join(util.GetAppDir(), "instance", mpname)
	if !util.IsDir(unpath) {
		return fmt.Errorf("实例目录不存在: %s", unpath)
	}

	util.Logger.Info("断点续传中", "instance", unpath, "platform", plat)

	progress := func(total, current int, name string) {
		d.emitter.EmitDownload(total, current, name)
	}
	if err := platHandler.DownloadFiles(info, unpath, progress); err != nil {
		return err
	}
	d.emitter.EmitChanged()

	if err := d.filterMods(unpath, mpname, modpackInfo.Minecraft); err != nil {
		return err
	}
	d.emitter.EmitChanged()

	if err := d.installModLoader(modpackInfo, unpath, isServerMode, template); err != nil {
		return err
	}

	d.completeTask(startTime, unpath, mpname, isServerMode)
	util.Logger.Info("续传完成", "duration", time.Since(startTime).Milliseconds())
	return nil
}

func (d *Dex) extractMrpackFromZip(buffer []byte, filename string) ([]byte, error) {
	// If filename doesn't end with .zip, return buffer as-is
	if filepath.Ext(filename) != ".zip" {
		return buffer, nil
	}

	// Try to find modpack.mrpack inside
	entries, err := ziputil.ReadZip(buffer)
	if err != nil {
		return buffer, nil
	}

	for _, entry := range entries {
		if entry.Name == "modpack.mrpack" {
			util.Logger.Info("在 PCL 风格压缩包中找到 modpack.mrpack")
			return entry.Data, nil
		}
	}

	return buffer, nil
}

type ZipProcessor struct {
	entries []ziputil.ZipEntry
	emitter ProgressEmitter
}

func (d *Dex) processZipEntries(buffer []byte) (*ZipProcessor, error) {
	entries, err := ziputil.ReadZip(buffer)
	if err != nil {
		return nil, err
	}

	return &ZipProcessor{entries: entries, emitter: d.emitter}, nil
}

func (zp *ZipProcessor) GetInfo() (string, map[string]interface{}, error) {
	importantFiles := []string{"manifest.json", "modrinth.index.json"}

	for _, entry := range zp.entries {
		for _, important := range importantFiles {
			if entry.Name == important {
				var info map[string]interface{}
				if err := json.Unmarshal(entry.Data, &info); err != nil {
					return "", nil, err
				}
				return important, info, nil
			}
		}
	}

	return "", nil, fmt.Errorf("no manifest found in zip")
}

func (zp *ZipProcessor) Unzip(instancePath string) error {
	os.MkdirAll(instancePath, 0755)

	idx := 0
	for _, entry := range zp.entries {
		idx++

		// Skip non-overrides files
		if !filepath.HasPrefix(entry.Name, "overrides/") {
			zp.emitter.EmitUnzip(entry.Name, len(zp.entries), idx)
			continue
		}

		// Skip overrides directory itself
		if entry.Name == "overrides/" || entry.Name == "overrides" {
			zp.emitter.EmitUnzip(entry.Name, len(zp.entries), idx)
			continue
		}

		// Check blacklist
		if ziputil.IsBlacklisted(entry.Name) {
			zp.emitter.EmitUnzip(entry.Name, len(zp.entries), idx)
			continue
		}

		// Extract file
		targetPath := filepath.Join(instancePath, stringsTrimPrefix(entry.Name, "overrides/"))

		if entry.IsDir {
			os.MkdirAll(targetPath, 0755)
		} else {
			os.MkdirAll(filepath.Dir(targetPath), 0755)
			os.WriteFile(targetPath, entry.Data, 0644)
		}

		zp.emitter.EmitUnzip(entry.Name, len(zp.entries), idx)
	}

	return nil
}

func stringsTrimPrefix(s, prefix string) string {
	if len(s) >= len(prefix) && s[:len(prefix)] == prefix {
		return s[len(prefix):]
	}
	return s
}

func filepathTrimPrefix(path, prefix string) string {
	if len(path) >= len(prefix) && path[:len(prefix)] == prefix {
		return path[len(prefix):]
	}
	return path
}

func (d *Dex) parallelTasks(zipProcessor *ZipProcessor, plat string, info map[string]interface{}, unpath string) error {
	// Run unzip and download in parallel using goroutines
	done := make(chan error, 2)

	// Unzip task — must use full instance path (same as download)
	go func() {
		done <- zipProcessor.Unzip(unpath)
	}()

	// Download task
	go func() {
		platHandler := platform.Platform(plat)
		if platHandler == nil {
			done <- nil
			return
		}

		progress := func(total, current int, name string) {
			d.emitter.EmitDownload(total, current, name)
		}
		done <- platHandler.DownloadFiles(info, unpath, progress)
	}()

	// Wait for both
	for i := 0; i < 2; i++ {
		if err := <-done; err != nil {
			return err
		}
	}

	return nil
}

func (d *Dex) filterMods(unpath, mpname, mcVersion string) error {
	// Skip mod filtering for MC 1.12.2 and below
	if javaVersionCompare(mcVersion, "1.12.2") <= 0 {
		util.Logger.Info("Minecraft 版本 <= 1.12.2，跳过模组筛选")
		d.emitter.EmitChanged()
		return nil
	}

	cfg := config.GetConfig()
	modsPath := filepath.Join(unpath, "mods")
	movePath := filepath.Join(util.GetAppDir(), ".rubbish", mpname)

	filterConfig := dearth.FilterConfig{
		Hashes:   cfg.Filter.Hashes,
		Dexpub:   cfg.Filter.Dexpub,
		Mixins:   cfg.Filter.Mixins,
		Modrinth: cfg.Filter.Modrinth,
		Mcmod:    cfg.Filter.Mcmod,
	}

	progress := func(current, total int, name string) {
		d.emitter.EmitFilterModsProgress(current, total, name)
	}

	mfs := dearth.NewModFilterService(modsPath, movePath, filterConfig, progress)
	mfs.OnStart = func(totalMods int) {
		d.emitter.EmitFilterModsStart(totalMods)
	}
	mfs.OnComplete = func(clientMods, success int, durationMs int64) {
		d.emitter.EmitFilterModsComplete(clientMods, success, durationMs)
	}
	return mfs.Filter()
}

func (d *Dex) installModLoader(modpackInfo *platform.ModpackInfo, unpath string, isServerMode bool, template string) error {
	progress := func(step string, current, total int) {
		d.emitter.EmitServerInstallStep(step, current, total)
	}

	if isServerMode {
		if isModLoaderAlreadyInstalled(unpath, modpackInfo) {
			util.Logger.Info("服务端核心已存在，跳过加载器安装", "path", unpath)
			d.emitter.EmitChanged()
			return nil
		}

		d.emitter.EmitServerInstallStart(
			"Server Installation",
			modpackInfo.Minecraft,
			modpackInfo.Loader,
			modpackInfo.LoaderVersion,
		)

		return modloader.MLSetup(
			modpackInfo.Loader,
			modpackInfo.Minecraft,
			modpackInfo.LoaderVersion,
			unpath,
			template,
			progress,
		)
	}

	return modloader.DInstall(
		modpackInfo.Loader,
		modpackInfo.Minecraft,
		modpackInfo.LoaderVersion,
		unpath,
	)
}

func isModLoaderAlreadyInstalled(unpath string, info *platform.ModpackInfo) bool {
	runBat := filepath.Join(unpath, "run.bat")
	if !util.FileExists(runBat) {
		return false
	}

	neoArgs := filepath.Join(unpath, "libraries", "net", "neoforged", "neoforge", info.LoaderVersion, "win_args.txt")
	forgeArgs := filepath.Join(unpath, "libraries", "net", "minecraftforge", "forge",
		info.Minecraft+"-"+info.LoaderVersion, "win_args.txt")

	return util.FileExists(neoArgs) || util.FileExists(forgeArgs)
}

func (d *Dex) completeTask(startTime time.Time, unpath, mpname string, isServerMode bool) {
	cfg := config.GetConfig()
	duration := time.Since(startTime).Milliseconds()

	if isServerMode {
		d.emitter.EmitServerInstallComplete(unpath, duration)
	}

	d.emitter.EmitFinish(duration)

	// Auto-zip if enabled
	if !isServerMode && cfg.AutoZip {
		outputPath := filepath.Join(util.GetAppDir(), "instance", mpname+".zip")
		if err := ziputil.CreateZip(unpath, outputPath); err != nil {
			util.Logger.Error("创建压缩包失败", "path", outputPath, "error", err.Error())
		} else {
			util.Logger.Info("已创建压缩包", "path", outputPath)
		}
	}

	// Open after finish if enabled
	if cfg.OAF {
		instancePath := filepath.Join(util.GetAppDir(), "instance")
		// Open in Explorer
		exec.Command("explorer", instancePath).Start()
	}
}

func (d *Dex) getModpackName(info map[string]interface{}) string {
	if name, ok := info["name"].(string); ok && name != "" {
		return util.SanitizePathName(name)
	}
	if versionID, ok := info["versionId"].(string); ok && versionID != "" {
		return util.SanitizePathName(versionID)
	}
	return "unknown-modpack"
}

func javaVersionCompare(v1, v2 string) int {
	// Simple version comparison
	a := stringsSplit(v1, ".")
	b := stringsSplit(v2, ".")

	for i := 0; i < max(len(a), len(b)); i++ {
		av := 0
		bv := 0
		if i < len(a) {
			av = parseInt(a[i])
		}
		if i < len(b) {
			bv = parseInt(b[i])
		}
		if av != bv {
			if av > bv {
				return 1
			}
			return -1
		}
	}
	return 0
}

func stringsSplit(s, sep string) []string {
	return strings.Split(s, sep)
}

func parseInt(s string) int {
	var n int
	for _, c := range strings.TrimSpace(s) {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		} else {
			break
		}
	}
	return n
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}