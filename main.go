package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"deearthx/core/config"
	"deearthx/core/dex"
	"deearthx/core/services"
	"deearthx/core/util"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

func main() {
	// Initialize utilities
	util.InitLogger()
	config.InitConfig()

	// Create Wails application
	app := application.New(application.Options{
		Name:        "DeEarthX V3",
		Description: "Minecraft Modpack to Server Converter",
		Icon:        appIcon,
		Services: []application.Service{
			application.NewService(services.NewDexService()),
			application.NewService(services.NewConfigService()),
			application.NewService(services.NewJavaService()),
			application.NewService(services.NewTemplateService()),
			application.NewService(services.NewDownloadService()),
			application.NewService(services.NewGalaxyService()),
			application.NewService(services.NewSponsorService()),
			application.NewService(services.NewModCheckService()),
			application.NewService(services.NewDialogService()),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// Register event types for type-safe bindings
	application.RegisterEvent[map[string]interface{}](dex.EventUnzip)
	application.RegisterEvent[map[string]interface{}](dex.EventDownload)
	application.RegisterEvent[map[string]interface{}](dex.EventChanged)
	application.RegisterEvent[map[string]interface{}](dex.EventFinish)
	application.RegisterEvent[map[string]interface{}](dex.EventError)
	application.RegisterEvent[map[string]interface{}](dex.EventInfo)
	application.RegisterEvent[map[string]interface{}](dex.EventServerInstallStart)
	application.RegisterEvent[map[string]interface{}](dex.EventServerInstallStep)
	application.RegisterEvent[map[string]interface{}](dex.EventServerInstallProgress)
	application.RegisterEvent[map[string]interface{}](dex.EventServerInstallComplete)
	application.RegisterEvent[map[string]interface{}](dex.EventServerInstallError)
	application.RegisterEvent[map[string]interface{}](dex.EventFilterModsStart)
	application.RegisterEvent[map[string]interface{}](dex.EventFilterModsProgress)
	application.RegisterEvent[map[string]interface{}](dex.EventFilterModsComplete)
	application.RegisterEvent[map[string]interface{}](dex.EventModCheckStart)
	application.RegisterEvent[map[string]interface{}](dex.EventModCheckProgress)
	application.RegisterEvent[map[string]interface{}](dex.EventModCheckComplete)
	application.RegisterEvent[map[string]interface{}](dex.EventModCheckError)

	// Register file drop event
	application.RegisterEvent[[]string](dex.EventFileDrop)

	// Create window with custom title bar (Frameless)
	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:           "DeEarthX V3",
		Width:           1024,
		Height:          600,
		MinWidth:        800,
		MinHeight:       500,
		Frameless:       true, // 无边框窗口，使用自定义标题栏
		BackgroundColour: application.NewRGB(255, 255, 255),
		URL:             "/",
		EnableFileDrop:  true,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
	})

	// Forward file drops to frontend via Wails event
	window.OnWindowEvent(events.Common.WindowFilesDropped, func(e *application.WindowEvent) {
		files := e.Context().DroppedFiles()
		app.Event.Emit(dex.EventFileDrop, files)
	})

	// Run
	err := app.Run()
	if err != nil {
		log.Fatal(err)
	}
}