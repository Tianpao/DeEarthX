package utils

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"
)

// InitLogger initializes the global slog logger with dual output:
//   - Console (stderr): human-friendly text format with UTC+8 time
//   - File: JSON format to <appDir>/logs/<timestamp>.log
//
// The log filename format is: 2006-01-02_15-04-05_<unixmill>.log
// (date + UTC+8 time + millisecond unix timestamp)
func InitLogger() {
	loc := time.FixedZone("CST", 8*60*60)
	now := time.Now()
	localTime := now.In(loc)

	appDir := GetAppDir()
	logDir := filepath.Join(appDir, "logs")

	if err := os.MkdirAll(logDir, 0o755); err != nil {
		slog.Error("failed to create log directory, using stderr only", "dir", logDir, "error", err)
		return
	}

	// Generate filename: 2026-07-28_14-30-05_1754023805123.log
	filename := fmt.Sprintf("%s_%d.log",
		localTime.Format("2006-01-02_15-04-05"),
		now.UnixMilli(),
	)

	logFile, err := os.Create(filepath.Join(logDir, filename))
	if err != nil {
		slog.Error("failed to create log file, using stderr only", "file", filename, "error", err)
		return
	}

	// ReplaceAttr: format time as UTC+8 human-readable string
	timeFmt := "2006-01-02 15:04:05.000"
	replaceTime := func(groups []string, a slog.Attr) slog.Attr {
		if a.Key == slog.TimeKey {
			a.Value = slog.StringValue(time.Now().In(loc).Format(timeFmt))
		}
		return a
	}

	consoleHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level:       slog.LevelDebug,
		ReplaceAttr: replaceTime,
	})

	fileHandler := slog.NewJSONHandler(logFile, &slog.HandlerOptions{
		Level:       slog.LevelDebug,
		ReplaceAttr: replaceTime,
	})

	slog.SetDefault(slog.New(newMultiHandler(consoleHandler, fileHandler)))
}

// multiHandler fans out log records to multiple slog.Handler instances.
type multiHandler struct {
	handlers []slog.Handler
}

func newMultiHandler(handlers ...slog.Handler) *multiHandler {
	return &multiHandler{handlers: handlers}
}

func (m *multiHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, h := range m.handlers {
		if h.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (m *multiHandler) Handle(ctx context.Context, r slog.Record) error {
	for _, h := range m.handlers {
		if h.Enabled(ctx, r.Level) {
			if err := h.Handle(ctx, r.Clone()); err != nil {
				return err
			}
		}
	}
	return nil
}

func (m *multiHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	handlers := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		handlers[i] = h.WithAttrs(attrs)
	}
	return newMultiHandler(handlers...)
}

func (m *multiHandler) WithGroup(name string) slog.Handler {
	handlers := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		handlers[i] = h.WithGroup(name)
	}
	return newMultiHandler(handlers...)
}
