package download

import "github.com/wailsapp/wails/v3/pkg/application"

// --- Server Install Events (download page) ---

// ServerInstallStartEvent is emitted when a server install begins.
type ServerInstallStartEvent struct {
	ModpackName      string `json:"modpackName"`
	MinecraftVersion string `json:"minecraftVersion"`
	LoaderType       string `json:"loaderType"`
	LoaderVersion    string `json:"loaderVersion"`
}

// ServerInstallStepEvent is emitted when the install progresses to a new step.
type ServerInstallStepEvent struct {
	Step       string `json:"step"`
	StepIndex  int    `json:"stepIndex"`
	TotalSteps int    `json:"totalSteps"`
}

// ServerInstallProgressEvent is emitted to report progress within a step.
type ServerInstallProgressEvent struct {
	Step     string `json:"step"`
	Progress int    `json:"progress"`
}

// ServerInstallCompleteEvent is emitted when the install finishes successfully.
type ServerInstallCompleteEvent struct {
	InstallPath string `json:"installPath"`
	Duration    int64  `json:"duration"` // milliseconds
}

// ServerInstallErrorEvent is emitted when the install fails.
type ServerInstallErrorEvent struct {
	Error string `json:"error"`
}

// --- Modpack Processing Events (orchestrator) ---

// PackStartEvent is emitted when a modpack processing begins.
type PackStartEvent struct {
	ModpackName      string `json:"modpackName"`
	MinecraftVersion string `json:"minecraftVersion"`
	LoaderType       string `json:"loaderType"`
	LoaderVersion    string `json:"loaderVersion"`
	Mode             string `json:"mode"` // "server" or "client"
}

// PackStepEvent is emitted when the processing advances to a new major step.
type PackStepEvent struct {
	Step       string `json:"step"`
	StepIndex  int    `json:"stepIndex"`
	TotalSteps int    `json:"totalSteps"`
}

// PackProgressEvent is emitted to report progress within the current step.
type PackProgressEvent struct {
	Step     string `json:"step"`
	Progress int    `json:"progress"`
}

// PackDownloadProgressEvent is emitted during mod file downloads.
type PackDownloadProgressEvent struct {
	Total     int    `json:"total"`
	Completed int    `json:"completed"`
	FileName  string `json:"fileName"`
}

// PackFilterStartEvent is emitted when mod filtering begins.
type PackFilterStartEvent struct {
	TotalMods int `json:"totalMods"`
}

// PackFilterProgressEvent is emitted during mod filtering.
type PackFilterProgressEvent struct {
	Current int    `json:"current"`
	Total   int    `json:"total"`
	ModName string `json:"modName"`
}

// PackFilterCompleteEvent is emitted when mod filtering finishes.
type PackFilterCompleteEvent struct {
	FilteredCount int `json:"filteredCount"`
	MovedCount    int `json:"movedCount"`
}

// PackCompleteEvent is emitted when modpack processing finishes successfully.
type PackCompleteEvent struct {
	InstallPath string `json:"installPath"`
	ModpackName string `json:"modpackName"`
	Duration    int64  `json:"duration"` // milliseconds
}

// PackErrorEvent is emitted when modpack processing fails.
type PackErrorEvent struct {
	Error string `json:"error"`
}

func init() {
	// Server install events
	application.RegisterEvent[ServerInstallStartEvent]("server_install_start")
	application.RegisterEvent[ServerInstallStepEvent]("server_install_step")
	application.RegisterEvent[ServerInstallProgressEvent]("server_install_progress")
	application.RegisterEvent[ServerInstallCompleteEvent]("server_install_complete")
	application.RegisterEvent[ServerInstallErrorEvent]("server_install_error")

	// Modpack processing events
	application.RegisterEvent[PackStartEvent]("pack_start")
	application.RegisterEvent[PackStepEvent]("pack_step")
	application.RegisterEvent[PackProgressEvent]("pack_progress")
	application.RegisterEvent[PackDownloadProgressEvent]("pack_download_progress")
	application.RegisterEvent[PackFilterStartEvent]("pack_filter_start")
	application.RegisterEvent[PackFilterProgressEvent]("pack_filter_progress")
	application.RegisterEvent[PackFilterCompleteEvent]("pack_filter_complete")
	application.RegisterEvent[PackCompleteEvent]("pack_complete")
	application.RegisterEvent[PackErrorEvent]("pack_error")
}
