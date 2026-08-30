package services

import (
	"context"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v3/pkg/application"

	"deearthx/core/dex"
)

// DexService is the main service for processing modpacks
type DexService struct {
	dex    *dex.Dex
	events *AppEventEmitter
}

// NewDexService creates a new DexService
func NewDexService() *DexService {
	return &DexService{}
}

// ServiceStartup is called when the service starts
func (s *DexService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	s.events = &AppEventEmitter{}
	s.dex = dex.NewDex(s.events)
	return nil
}

// StartTask starts processing a modpack from file data
func (s *DexService) StartTask(ctx context.Context, fileData []byte, filename, mode, template string) error {
	isServerMode := mode == "server"

	go func() {
		defer func() {
			if r := recover(); r != nil {
				s.events.EmitError("Panic during processing")
			}
		}()

		err := s.dex.ProcessModpack(fileData, filename, isServerMode, template)
		if err != nil {
			s.events.EmitError(err.Error())
		}
	}()

	return nil
}

// StartTaskFromPath starts processing a modpack from a file path
func (s *DexService) StartTaskFromPath(ctx context.Context, filePath, mode, template string) error {
	isServerMode := mode == "server"

	go func() {
		defer func() {
			if r := recover(); r != nil {
				s.events.EmitError("Panic during processing")
			}
		}()

		// Read file from path
		data, err := os.ReadFile(filePath)
		if err != nil {
			s.events.EmitError("Failed to read file: " + err.Error())
			return
		}

		filename := filepath.Base(filePath)
		err = s.dex.ProcessModpack(data, filename, isServerMode, template)
		if err != nil {
			s.events.EmitError(err.Error())
		}
	}()

	return nil
}

// ResumeFromPath continues a previous task from a modpack file path (skip unzip).
func (s *DexService) ResumeFromPath(ctx context.Context, filePath, mode, template string) error {
	isServerMode := mode == "server"

	go func() {
		defer func() {
			if r := recover(); r != nil {
				s.events.EmitError("Panic during resume")
			}
		}()

		err := s.dex.ResumeFromPath(filePath, isServerMode, template)
		if err != nil {
			s.events.EmitError(err.Error())
		}
	}()

	return nil
}

// AppEventEmitter emits events via Wails
type AppEventEmitter struct{}

func (e *AppEventEmitter) getEvent() *application.EventManager {
	return application.Get().Event
}

func (e *AppEventEmitter) EmitUnzip(filename string, total, current int) {
	e.getEvent().Emit(dex.EventUnzip, map[string]interface{}{
		"name":    filename,
		"total":   total,
		"current": current,
	})
}

func (e *AppEventEmitter) EmitDownload(total, current int, name string) {
	e.getEvent().Emit(dex.EventDownload, map[string]interface{}{
		"total":   total,
		"current": current,
		"name":    name,
	})
}

func (e *AppEventEmitter) EmitChanged() {
	e.getEvent().Emit(dex.EventChanged, map[string]interface{}{})
}

func (e *AppEventEmitter) EmitFinish(duration int64) {
	e.getEvent().Emit(dex.EventFinish, map[string]interface{}{
		"duration": duration,
	})
}

func (e *AppEventEmitter) EmitError(message string) {
	e.getEvent().Emit(dex.EventError, map[string]interface{}{
		"message": message,
	})
}

func (e *AppEventEmitter) EmitInfo(message string) {
	e.getEvent().Emit(dex.EventInfo, map[string]interface{}{
		"message": message,
	})
}

func (e *AppEventEmitter) EmitServerInstallStart(title, mcVersion, loader, loaderVersion string) {
	e.getEvent().Emit(dex.EventServerInstallStart, map[string]interface{}{
		"title":         title,
		"mcVersion":     mcVersion,
		"loader":        loader,
		"loaderVersion": loaderVersion,
	})
}

func (e *AppEventEmitter) EmitServerInstallStep(step string, current, total int) {
	e.getEvent().Emit(dex.EventServerInstallStep, map[string]interface{}{
		"step":    step,
		"current": current,
		"total":   total,
	})
}

func (e *AppEventEmitter) EmitServerInstallProgress(step string, progress int) {
	e.getEvent().Emit(dex.EventServerInstallProgress, map[string]interface{}{
		"step":     step,
		"progress": progress,
	})
}

func (e *AppEventEmitter) EmitServerInstallComplete(path string, duration int64) {
	e.getEvent().Emit(dex.EventServerInstallComplete, map[string]interface{}{
		"path":     path,
		"duration": duration,
	})
}

func (e *AppEventEmitter) EmitFilterModsStart(totalMods int) {
	e.getEvent().Emit(dex.EventFilterModsStart, map[string]interface{}{
		"totalMods": totalMods,
	})
}

func (e *AppEventEmitter) EmitFilterModsProgress(current, total int, name string) {
	e.getEvent().Emit(dex.EventFilterModsProgress, map[string]interface{}{
		"current": current,
		"total":   total,
		"name":    name,
	})
}

func (e *AppEventEmitter) EmitFilterModsComplete(clientMods, success int, duration int64) {
	e.getEvent().Emit(dex.EventFilterModsComplete, map[string]interface{}{
		"clientMods": clientMods,
		"success":    success,
		"duration":   duration,
	})
}