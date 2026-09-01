package util

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

var Logger *slog.Logger

var (
	logLevel     = &slog.LevelVar{}
	uiSinkMu     sync.RWMutex
	uiLogSink    UILogFunc
	uiLogEnabled atomic.Bool
	logFileRef   *os.File
)

// UILogFunc pushes a log line to the frontend (info and above).
type UILogFunc func(level, message string)

// SetUILogSink registers the frontend log emitter (call after Wails app starts).
func SetUILogSink(fn UILogFunc) {
	uiSinkMu.Lock()
	defer uiSinkMu.Unlock()
	uiLogSink = fn
}

// SetUILogEnabled controls whether info+ logs are pushed to the process log panel.
func SetUILogEnabled(enabled bool) {
	uiLogEnabled.Store(enabled)
}

// SetLogLevel sets the minimum log level: "debug" or "info" (default).
func SetLogLevel(level string) {
	normalized := strings.ToLower(strings.TrimSpace(level))
	switch normalized {
	case "debug":
		logLevel.Set(slog.LevelDebug)
	default:
		logLevel.Set(slog.LevelInfo)
	}
}

// discardOnErrorWriter writes to w but never returns an error (e.g. GUI builds with no console).
type discardOnErrorWriter struct {
	w io.Writer
}

func (d discardOnErrorWriter) Write(p []byte) (int, error) {
	n, err := d.w.Write(p)
	if err != nil {
		return len(p), nil
	}
	return n, nil
}

// uiHandler forwards Info+ records to the frontend during an active task.
type uiHandler struct {
	level *slog.LevelVar
}

func (h *uiHandler) Enabled(_ context.Context, level slog.Level) bool {
	return level >= slog.LevelInfo && level >= h.level.Level()
}

func (h *uiHandler) Handle(_ context.Context, r slog.Record) error {
	if !uiLogEnabled.Load() {
		return nil
	}
	uiSinkMu.RLock()
	sink := uiLogSink
	uiSinkMu.RUnlock()
	if sink == nil {
		return nil
	}

	msg := formatRecordMessage(r)
	levelName := "info"
	switch {
	case r.Level >= slog.LevelError:
		levelName = "error"
	case r.Level >= slog.LevelWarn:
		levelName = "warn"
	}
	sink(levelName, msg)
	return nil
}

func (h *uiHandler) WithAttrs(attrs []slog.Attr) slog.Handler { return h }
func (h *uiHandler) WithGroup(name string) slog.Handler       { return h }

func formatRecordMessage(r slog.Record) string {
	var b strings.Builder
	b.WriteString(r.Message)
	r.Attrs(func(a slog.Attr) bool {
		if a.Key == "" || a.Equal(slog.Attr{}) {
			return true
		}
		b.WriteString(" | ")
		b.WriteString(a.Key)
		b.WriteString("=")
		b.WriteString(a.Value.String())
		return true
	})
	msg := b.String()
	const maxUI = 240
	runes := []rune(msg)
	if len(runes) > maxUI {
		msg = string(runes[:maxUI]) + "…"
	}
	return msg
}

func chineseLevel(_ []string, a slog.Attr) slog.Attr {
	if a.Key == slog.LevelKey {
		level := a.Value.Any().(slog.Level)
		switch {
		case level >= slog.LevelError:
			return slog.String(slog.LevelKey, "错误")
		case level >= slog.LevelWarn:
			return slog.String(slog.LevelKey, "警告")
		case level >= slog.LevelInfo:
			return slog.String(slog.LevelKey, "信息")
		default:
			return slog.String(slog.LevelKey, "调试")
		}
	}
	return a
}

// InitLogger initializes the structured logger with file output and UI bridge.
func InitLogger() {
	logLevel.Set(slog.LevelInfo)

	appDir := GetAppDir()
	logsDir := filepath.Join(appDir, "logs")

	if err := os.MkdirAll(logsDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "创建日志目录失败: %v\n", err)
	}

	logFileName := fmt.Sprintf("%s-%d.log",
		time.Now().Format("2006-01-02"),
		time.Now().UnixMilli())
	logFilePath := filepath.Join(logsDir, logFileName)

	opts := &slog.HandlerOptions{
		Level:       logLevel,
		ReplaceAttr: chineseLevel,
	}

	var fileHandler slog.Handler
	logFile, err := os.Create(logFilePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "创建日志文件失败: %v\n", err)
		fileHandler = slog.NewTextHandler(discardOnErrorWriter{w: os.Stdout}, opts)
	} else {
		logFileRef = logFile
		multiWriter := io.MultiWriter(logFile, discardOnErrorWriter{w: os.Stdout})
		fileHandler = slog.NewTextHandler(multiWriter, opts)
	}

	Logger = slog.New(multiHandler{
		handlers: []slog.Handler{
			fileHandler,
			&uiHandler{level: logLevel},
		},
	})
	slog.SetDefault(Logger)

	Logger.Debug("日志系统已初始化", "路径", logFilePath)
	if logFile != nil {
		_ = logFile.Sync()
	}
}

// multiHandler fans out to multiple handlers.
type multiHandler struct {
	handlers []slog.Handler
}

func (m multiHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, h := range m.handlers {
		if h.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (m multiHandler) Handle(ctx context.Context, r slog.Record) error {
	var firstErr error
	for _, h := range m.handlers {
		if !h.Enabled(ctx, r.Level) {
			continue
		}
		if err := h.Handle(ctx, r.Clone()); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func (m multiHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	hs := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		hs[i] = h.WithAttrs(attrs)
	}
	return multiHandler{handlers: hs}
}

func (m multiHandler) WithGroup(name string) slog.Handler {
	hs := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		hs[i] = h.WithGroup(name)
	}
	return multiHandler{handlers: hs}
}

// CloseLogger closes the log file if it was opened
func CloseLogger() {
	if logFileRef != nil {
		_ = logFileRef.Close()
		logFileRef = nil
	}
}
