package util

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"time"
)

var Logger *slog.Logger

// InitLogger initializes the structured logger with console and file output
func InitLogger() {
	appDir := GetAppDir()
	logsDir := filepath.Join(appDir, "logs")

	// Ensure logs directory exists
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create logs directory: %v\n", err)
	}

	// Generate log file name
	logFileName := fmt.Sprintf("%s-%d.log",
		time.Now().Format("2006-01-02"),
		time.Now().UnixMilli())
	logFilePath := filepath.Join(logsDir, logFileName)

	// Create log file
	logFile, err := os.Create(logFilePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create log file: %v\n", err)
		Logger = slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelDebug,
		}))
		slog.SetDefault(Logger)
		return
	}

	// Create multi-writer handler
	multiWriter := io.MultiWriter(os.Stdout, logFile)
	multiHandler := slog.NewTextHandler(multiWriter, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})

	Logger = slog.New(multiHandler)
	slog.SetDefault(Logger)

	Logger.Info("Logger initialized", "path", logFilePath)
}

// CloseLogger closes the log file if it was opened
func CloseLogger() {
	// slog doesn't provide a way to close handlers,
	// but the file will be closed when the program exits
}