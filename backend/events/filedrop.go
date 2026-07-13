package events

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// RegisterFileDropHandler registers a window event listener for file drops
// and forwards the dropped files to the frontend via the "files-dropped" event.
func RegisterFileDropHandler(app *application.App, win *application.WebviewWindow) {
	win.OnWindowEvent(events.Common.WindowFilesDropped, func(event *application.WindowEvent) {
		files := event.Context().DroppedFiles()
		details := event.Context().DropTargetDetails()
		app.Event.Emit("files-dropped", map[string]any{
			"files":   files,
			"details": details,
		})
	})
}
