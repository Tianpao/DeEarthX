package dex

// Event type constants for Wails events
const (
	EventUnzip                = "unzip"
	EventDownload             = "downloading"
	EventChanged              = "changed"
	EventFinish               = "finish"
	EventError                = "error"
	EventInfo                 = "info"
	EventMessage              = "message"
	EventServerInstallStart   = "server_install_start"
	EventServerInstallStep    = "server_install_step"
	EventServerInstallProgress = "server_install_progress"
	EventServerInstallComplete = "server_install_complete"
	EventServerInstallError   = "server_install_error"
	EventFilterModsStart      = "filter_mods_start"
	EventFilterModsProgress   = "filter_mods_progress"
	EventFilterModsComplete   = "filter_mods_complete"
	EventFilterModsError      = "filter_mods_error"
	EventModCheckStart        = "modcheck_start"
	EventModCheckProgress     = "modcheck_progress"
	EventModCheckComplete     = "modcheck_complete"
	EventModCheckError        = "modcheck_error"
	EventFileDrop             = "file_drop"
)