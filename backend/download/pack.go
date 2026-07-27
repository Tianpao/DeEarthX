package download

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"dex/backend/dearth"
	"dex/backend/dearth/types"
	"dex/backend/modloader"
	"dex/backend/platform"
	"dex/backend/utils"
)

// ModpackService is the Wails service that orchestrates the full
// modpack processing pipeline (extract → parse → download mods →
// filter client-side mods → install modloader → optional zip/reveal).
type ModpackService struct{}

// NewModpackService creates a new ModpackService instance.
func NewModpackService() *ModpackService {
	return &ModpackService{}
}

// Processing mode constants.
const (
	ModeServer = "server"
	ModeClient = "client"
)

// Total steps in the pipeline (reported via pack_step events).
//   1. 解析整合包   (parse)
//   2. 解压 overrides + 下载 mod (concurrent)
//   3. 过滤客户端 mod (filter)
//   4. 安装加载器    (install)
//   5. 完成          (complete)
const totalSteps = 5

// ProcessModpackFromPath reads a modpack file from disk and runs the full pipeline.
// Returns the instance install path immediately; progress is reported via Wails events.
func (s *ModpackService) ProcessModpackFromPath(path string, mode string) (string, error) {
	if path == "" {
		return "", fmt.Errorf("modpack path is required")
	}
	if mode == "" {
		mode = ModeServer
	}

	buffer, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("failed to read modpack file: %w", err)
	}

	return s.start(buffer, path, mode)
}

// ProcessModpack runs the full pipeline on an in-memory modpack buffer.
// Returns the instance install path immediately; progress is reported via Wails events.
func (s *ModpackService) ProcessModpack(buffer []byte, filename string, mode string) (string, error) {
	if len(buffer) == 0 {
		return "", fmt.Errorf("modpack buffer is empty")
	}
	if mode == "" {
		mode = ModeServer
	}

	return s.start(buffer, filename, mode)
}

// start kicks off the async pipeline goroutine and returns the install path.
func (s *ModpackService) start(buffer []byte, filename string, mode string) (string, error) {
	instanceName := sanitizeInstanceName(filename)
	installPath := filepath.Join(utils.GetAppDir(), "instance", instanceName)

	if err := os.MkdirAll(installPath, 0o755); err != nil {
		return "", fmt.Errorf("failed to create instance directory: %w", err)
	}

	go s.runPipeline(buffer, filename, mode, instanceName, installPath)

	return installPath, nil
}

// runPipeline is the core orchestration, executed in a goroutine.
// Each phase emits pack_step/pack_progress events; failures emit pack_error.
func (s *ModpackService) runPipeline(buffer []byte, filename, mode, instanceName, installPath string) {
	startTime := time.Now()

	fail := func(step string, err error) {
		emitEvent("pack_error", PackErrorEvent{
			Error: fmt.Sprintf("%s: %v", step, err),
		})
	}

	// --- Phase 1: Parse the modpack (extract nested mrpack, find manifest) ---
	emitStep("解析整合包", 1)

	processed, err := ExtractMrpackFromZip(buffer, filename)
	if err != nil {
		fail("解析整合包失败", err)
		return
	}

	zipInfo, err := ProcessZipEntries(processed)
	if err != nil {
		fail("未找到整合包清单", err)
		return
	}

	platName := platform.WhatPlatform(zipInfo.ManifestType)
	if platName == "" {
		fail("无法识别整合包平台", fmt.Errorf("unknown manifest: %s", zipInfo.ManifestType))
		return
	}

	plat := platform.NewPlatform(platName)
	if plat == nil {
		fail("不支持的平台", fmt.Errorf("unsupported platform: %s", platName))
		return
	}

	info, err := plat.GetInfo(zipInfo.ManifestData)
	if err != nil {
		fail("解析清单信息失败", err)
		return
	}

	emitEvent("pack_start", PackStartEvent{
		ModpackName:      instanceName,
		MinecraftVersion: info.Minecraft,
		LoaderType:       info.Loader,
		LoaderVersion:    info.LoaderVersion,
		Mode:             mode,
	})

	// --- Phase 2 & 3: Extract overrides and download mods concurrently ---
	emitStep("解压 overrides / 下载 mod", 2)

	var extractErr, downloadErr error
	var wg sync.WaitGroup

	wg.Add(2)

	go func() {
		defer wg.Done()
		extractErr = UnzipOverrides(processed, instanceName, utils.GetAppDir(), func(p UnzipProgress) {
			pct := 0
			if p.Total > 0 {
				pct = int(float64(p.Current) / float64(p.Total) * 100)
			}
			emitEvent("pack_progress", PackProgressEvent{
				Step:     "解压 overrides",
				Progress: pct,
			})
		})
	}()

	go func() {
		defer wg.Done()
		downloadErr = plat.DownloadFile(zipInfo.ManifestData, installPath, func(total, completed int, name string) {
			emitEvent("pack_download_progress", PackDownloadProgressEvent{
				Total:     total,
				Completed: completed,
				FileName:  filepath.Base(name),
			})
		})
	}()

	wg.Wait()

	if extractErr != nil {
		fail("解压 overrides 失败", extractErr)
		return
	}
	if downloadErr != nil {
		fail("下载 mod 失败", downloadErr)
		return
	}

	// --- Phase 4: Filter client-side mods (skip for MC <= 1.12.2) ---
	if utils.VersionCompare(info.Minecraft, "1.12.2") == 1 {
		emitStep("过滤客户端 mod", 3)
		if err := s.filterMods(installPath); err != nil {
			// Filtering failures are non-fatal — log but continue
			fmt.Printf("warning: mod filter failed: %v\n", err)
			emitEvent("pack_filter_complete", PackFilterCompleteEvent{
				FilteredCount: 0,
				MovedCount:    0,
			})
		}
	}

	// --- Phase 5: Install modloader ---
	emitStep("安装加载器", 4)
	if err := s.installLoader(info, installPath, mode); err != nil {
		fail("安装加载器失败", err)
		return
	}

	// --- Completion: optional zip + reveal folder ---
	emitStep("完成", 5)

	duration := time.Since(startTime).Milliseconds()

	// Client mode with autoZip enabled: archive the instance
	if mode == ModeClient {
		if autoZip, _ := utils.GlobalConfig.GetConfigValue("autoZip").(bool); autoZip {
			if err := CreateZipArchive(installPath, instanceName, utils.GetAppDir()); err != nil {
				fmt.Printf("warning: failed to create zip archive: %v\n", err)
			}
		}
	}

	// Open-after-finish (oaf): reveal the instance folder
	if oaf, _ := utils.GlobalConfig.GetConfigValue("oaf").(bool); oaf {
		revealFolder(installPath)
	}

	emitEvent("pack_complete", PackCompleteEvent{
		InstallPath: installPath,
		ModpackName: instanceName,
		Duration:    duration,
	})
}

// filterMods runs the dearth ModFilterService against the mods/ directory
// in the install path, moving client-side mods to a rubbish subdirectory.
func (s *ModpackService) filterMods(installPath string) error {
	modsPath := filepath.Join(installPath, "mods")
	movePath := filepath.Join(installPath, "rubbish")

	// Build filter config from app config
	filterConfig := types.FilterConfig{
		Hashes:   boolConfig("filter.hashes", true),
		Dexpub:   boolConfig("filter.dexpub", true),
		Mixins:   boolConfig("filter.mixins", false),
		Modrinth: boolConfig("filter.modrinth", true),
		Mcmod:    boolConfig("filter.mcmod", true),
	}

	mfs := dearth.NewModFilterService(modsPath, movePath, filterConfig)

	// Emit filter start with total mod count
	emitEvent("pack_filter_start", PackFilterStartEvent{
		TotalMods: countJars(modsPath),
	})

	// Identify client-side mods first for per-mod progress reporting
	files, err := mfs.IdentifyOnly()
	if err == nil {
		for i := range files {
			emitEvent("pack_filter_progress", PackFilterProgressEvent{
				Current: i + 1,
				Total:   len(files),
				ModName: filepath.Base(files[i]),
			})
		}
	}

	// Run the full filter (extract → identify → move)
	return mfs.Filter()
}

// installLoader runs the appropriate modloader installation for the mode.
func (s *ModpackService) installLoader(info *platform.ModpackInfo, installPath, mode string) error {
	loader := info.Loader
	if loader == "" {
		return fmt.Errorf("no modloader specified in modpack")
	}

	if mode == ModeServer {
		// Server mode: full setup (Minecraft server jar + loader)
		// MLSetup handles both: Minecraft.Setup() then Loader.Setup()
		return modloader.MLSetup(loader, info.Minecraft, info.LoaderVersion, installPath)
	}

	// Client mode: lightweight install (download installer + write scripts)
	return modloader.DInstall(loader, info.Minecraft, info.LoaderVersion, installPath)
}

// --- Helpers ---

// emitStep emits a pack_step event with the given step label and index.
func emitStep(step string, index int) {
	emitEvent("pack_step", PackStepEvent{
		Step:       step,
		StepIndex:  index,
		TotalSteps: totalSteps,
	})
}

// sanitizeInstanceName derives a filesystem-safe instance name from a filename.
func sanitizeInstanceName(filename string) string {
	base := filepath.Base(filename)
	// Strip known modpack extensions
	for _, ext := range []string{".zip", ".mrpack"} {
		base = strings.TrimSuffix(base, ext)
	}
	// Replace characters that are problematic on the filesystem
	replacer := strings.NewReplacer(
		" ", "_",
		"/", "_",
		"\\", "_",
		":", "_",
		"*", "_",
		"?", "_",
		"\"", "_",
		"<", "_",
		">", "_",
		"|", "_",
	)
	clean := replacer.Replace(base)
	if clean == "" {
		clean = "modpack"
	}
	// Append a short timestamp suffix to avoid collisions
	ts := fmt.Sprintf("%d", time.Now().UnixMilli())[6:10]
	return fmt.Sprintf("%s-%s", clean, ts)
}

// boolConfig reads a boolean config value with a default fallback.
func boolConfig(key string, def bool) bool {
	v := utils.GlobalConfig.GetConfigValue(key)
	if b, ok := v.(bool); ok {
		return b
	}
	return def
}

// countJars counts the .jar files in a directory.
func countJars(dir string) int {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	count := 0
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".jar") {
			count++
		}
	}
	return count
}

// revealFolder opens the platform file explorer at the given directory.
func revealFolder(path string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", path)
	case "darwin":
		cmd = exec.Command("open", path)
	default:
		cmd = exec.Command("xdg-open", path)
	}
	_ = cmd.Start()
}
