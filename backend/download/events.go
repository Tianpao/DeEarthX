package download

import "github.com/wailsapp/wails/v3/pkg/application"

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

func init() {
	application.RegisterEvent[ServerInstallStartEvent]("server_install_start")
	application.RegisterEvent[ServerInstallStepEvent]("server_install_step")
	application.RegisterEvent[ServerInstallProgressEvent]("server_install_progress")
	application.RegisterEvent[ServerInstallCompleteEvent]("server_install_complete")
	application.RegisterEvent[ServerInstallErrorEvent]("server_install_error")
}
