package utils

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"resty.dev/v3"
)

const (
	DefaultChunkSize   int64 = 5 * 1024 * 1024 // 5 MB
	DefaultConcurrency int   = 32
	DefaultFileConcurrency int = 16
	WFileConcurrency        int = 64
	MaxChunkRetries         int = 3
)

type DownloadOption struct {
	URL          string
	FilePath     string
	ExpectedHash string
	UseChunked   bool  // 启用单文件分片多线程下载
	ChunkSize    int64 // 分片大小（字节），默认 5MB
	Concurrency  int   // 单文件分片并发数，默认 32
}

func NewDownloadClient() *DownloadClient {
	client := resty.New().
		SetHeader("User-Agent", "DeEarthX").
		SetRetryCount(3).
		SetTimeout(60 * time.Second)
	return &DownloadClient{
		client: client,
	}
}

type DownloadClient struct {
	client *resty.Client
}

// Download downloads a file from url to filePath with a single connection.
// Optionally verifies SHA1 hash after download.
func (dc *DownloadClient) Download(url, filePath string, expectedHash ...string) error {
	// Ensure parent directory exists
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	// Download to temp file first
	tmpPath := filePath + ".downloading"
	// Clean up any stale temp file from a previous interrupted download
	os.Remove(tmpPath)

	resp, err := dc.client.R().Get(url)
	if err != nil {
		return fmt.Errorf("download failed for %s: %w", url, err)
	}
	if resp.StatusCode() >= 400 {
		return fmt.Errorf("download failed for %s: HTTP %d", url, resp.StatusCode())
	}

	data := resp.Bytes()
	if err := os.WriteFile(tmpPath, data, 0o644); err != nil {
		os.Remove(tmpPath) // clean up partial file on write failure
		return fmt.Errorf("failed to write file %s: %w", tmpPath, err)
	}

	// Verify SHA1 if provided
	if len(expectedHash) > 0 && expectedHash[0] != "" {
		if !VerifySHA1(tmpPath, expectedHash[0]) {
			os.Remove(tmpPath)
			return fmt.Errorf("SHA1 verification failed for %s", filePath)
		}
	}

	// Atomic rename
	if err := os.Rename(tmpPath, filePath); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("failed to rename temp file: %w", err)
	}

	return nil
}

// ChunkedDownload downloads a single file using parallel range requests.
// It first sends a HEAD request to check if the server supports Range requests.
// If not, it falls back to a simple single-connection download.
func (dc *DownloadClient) ChunkedDownload(url, filePath string, expectedHash ...string) error {
	return dc.ChunkedDownloadWithOptions(DownloadOption{
		URL:          url,
		FilePath:     filePath,
		ExpectedHash: firstOrEmpty(expectedHash),
		UseChunked:   true,
		ChunkSize:    DefaultChunkSize,
		Concurrency:  DefaultConcurrency,
	})
}

// ChunkedDownloadWithOptions downloads a file with full control over chunked settings.
func (dc *DownloadClient) ChunkedDownloadWithOptions(opts DownloadOption) error {
	url := opts.URL
	filePath := opts.FilePath
	expectedHash := opts.ExpectedHash

	// Ensure parent directory exists
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	// HEAD request to check server support
	headResp, err := dc.client.R().Head(url)
	if err != nil {
		// HEAD failed, fall back to simple download
		return dc.Download(url, filePath, expectedHash)
	}

	// Check Accept-Ranges header
	acceptRanges := headResp.Header().Get("Accept-Ranges")
	contentLengthStr := headResp.Header().Get("Content-Length")

	if acceptRanges != "bytes" || contentLengthStr == "" {
		// Server doesn't support Range requests, fall back
		return dc.Download(url, filePath, expectedHash)
	}

	fileSize, err := strconv.ParseInt(contentLengthStr, 10, 64)
	if err != nil || fileSize <= 0 {
		return dc.Download(url, filePath, expectedHash)
	}

	// Determine chunk size and concurrency
	chunkSize := opts.ChunkSize
	if chunkSize <= 0 {
		chunkSize = DefaultChunkSize
	}
	concurrency := opts.Concurrency
	if concurrency <= 0 {
		concurrency = DefaultConcurrency
	}

	// If file is smaller than chunk size, just use simple download
	if fileSize <= chunkSize {
		slog.Debug("chunked download skipped, using simple download",
			"file", filepath.Base(filePath),
			"size", fileSize,
			"chunkSize", chunkSize,
		)
		return dc.Download(url, filePath, expectedHash)
	}

	// Calculate chunks
	var chunks []chunkRange
	for offset := int64(0); offset < fileSize; offset += chunkSize {
		end := offset + chunkSize - 1
		if end >= fileSize {
			end = fileSize - 1
		}
		chunks = append(chunks, chunkRange{start: offset, end: end})
	}

	slog.Info("chunked download started",
		"file", filepath.Base(filePath),
		"size", fileSize,
		"chunks", len(chunks),
		"concurrency", concurrency,
	)

	// Create temp file and pre-allocate
	tmpPath := filePath + ".downloading"
	// Clean up any stale temp file from a previous interrupted download
	os.Remove(tmpPath)

	f, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	if err := f.Truncate(fileSize); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return fmt.Errorf("failed to allocate file: %w", err)
	}

	// Download chunks in parallel with bounded concurrency
	var wg sync.WaitGroup
	errCh := make(chan error, len(chunks))
	sem := make(chan struct{}, concurrency)

	for i, chunk := range chunks {
		wg.Add(1)
		go func(idx int, cr chunkRange) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			if err := dc.downloadChunk(url, f, cr); err != nil {
				errCh <- fmt.Errorf("chunk %d (%d-%d) failed: %w", idx, cr.start, cr.end, err)
			}
		}(i, chunk)
	}

	wg.Wait()
	close(errCh)

	// Check for chunk errors
	var errors []error
	for err := range errCh {
		errors = append(errors, err)
	}

	f.Close()

	if len(errors) > 0 {
		os.Remove(tmpPath)
		return fmt.Errorf("chunked download failed with %d errors: %w", len(errors), errors[0])
	}

	// Verify SHA1 if provided
	if expectedHash != "" {
		if !VerifySHA1(tmpPath, expectedHash) {
			os.Remove(tmpPath)
			return fmt.Errorf("SHA1 verification failed for %s", filePath)
		}
	}

	// Atomic rename
	if err := os.Rename(tmpPath, filePath); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("failed to rename temp file: %w", err)
	}

	return nil
}

// chunkRange represents a byte range for a download chunk.
type chunkRange struct {
	start int64
	end   int64
}

// downloadChunk downloads a single chunk with retries and 429 backoff.
func (dc *DownloadClient) downloadChunk(url string, f *os.File, cr chunkRange) error {
	rangeHeader := fmt.Sprintf("bytes=%d-%d", cr.start, cr.end)

	for attempt := 0; attempt < MaxChunkRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff for retries
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			time.Sleep(backoff)
		}

		resp, err := dc.client.R().
			SetHeader("Range", rangeHeader).
			Get(url)
		if err != nil {
			continue
		}

		// Handle 429 Too Many Requests
		if resp.StatusCode() == http.StatusTooManyRequests {
			retryAfter := resp.Header().Get("Retry-After")
			waitTime := 2 * time.Second
			if secs, err := strconv.Atoi(retryAfter); err == nil && secs > 0 {
				waitTime = time.Duration(secs) * time.Second
			}
			time.Sleep(waitTime)
			continue
		}

		if resp.StatusCode() != http.StatusPartialContent && resp.StatusCode() != http.StatusOK {
			return fmt.Errorf("unexpected status %d for range %s", resp.StatusCode(), rangeHeader)
		}

		data := resp.Bytes()
		if int64(len(data)) != cr.end-cr.start+1 {
			return fmt.Errorf("chunk size mismatch: expected %d, got %d", cr.end-cr.start+1, len(data))
		}

		// Write at the correct offset
		if _, err := f.WriteAt(data, cr.start); err != nil {
			return fmt.Errorf("write at offset %d failed: %w", cr.start, err)
		}

		return nil
	}

	return fmt.Errorf("chunk %s failed after %d retries", rangeHeader, MaxChunkRetries)
}

// FastDownload downloads multiple files concurrently using a worker pool.
// For items with UseChunked=true, uses ChunkedDownloadWithOptions; otherwise simple Download.
func FastDownload(items []DownloadOption) error {
	if len(items) == 0 {
		return nil
	}

	client := NewDownloadClient()

	var wg sync.WaitGroup
	errCh := make(chan error, len(items))
	sem := make(chan struct{}, DefaultFileConcurrency)

	slog.Info("FastDownload starting",
		"files", len(items),
		"maxConcurrency", DefaultFileConcurrency,
	)

	for _, item := range items {
		wg.Add(1)
		go func(opt DownloadOption) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			slog.Debug("FastDownload: file started",
				"file", filepath.Base(opt.FilePath),
			)

			var err error
			if opt.UseChunked {
				err = client.ChunkedDownloadWithOptions(opt)
			} else {
				hash := opt.ExpectedHash
				if hash != "" {
					err = client.Download(opt.URL, opt.FilePath, hash)
				} else {
					err = client.Download(opt.URL, opt.FilePath)
				}
			}
			if err != nil {
				slog.Error("FastDownload: file failed",
					"file", filepath.Base(opt.FilePath),
					"error", err,
				)
				errCh <- err
			} else {
				slog.Info("FastDownload: file done",
					"file", filepath.Base(opt.FilePath),
				)
			}
		}(item)
	}

	wg.Wait()
	close(errCh)

	var errors []error
	for err := range errCh {
		errors = append(errors, err)
	}

	if len(errors) > 0 {
		return fmt.Errorf("fastdownload completed with %d errors: %v", len(errors), errors[0])
	}

	return nil
}

// WFastDownload downloads multiple files concurrently with progress reporting and chunked download support.
// progressFn is called each time a file completes: progressFn(total, completed, filePath)
// By default, items will use chunked download unless UseChunked is explicitly set to false.
func WFastDownload(items []DownloadOption, progressFn func(total, completed int, name string)) error {
	if len(items) == 0 {
		return nil
	}

	client := NewDownloadClient()

	var mu sync.Mutex
	completed := 0
	total := len(items)

	var wg sync.WaitGroup
	errCh := make(chan error, len(items))
	sem := make(chan struct{}, WFileConcurrency)

	slog.Info("WFastDownload starting",
		"files", total,
		"maxConcurrency", WFileConcurrency,
	)

	for _, item := range items {
		wg.Add(1)
		go func(opt DownloadOption) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			slog.Debug("WFastDownload: file started",
				"file", filepath.Base(opt.FilePath),
				"active", len(sem),
			)

			// Default to chunked download for WFastDownload
			useChunked := opt.UseChunked
			if useChunked && opt.ChunkSize == 0 {
				opt.ChunkSize = DefaultChunkSize
			}
			if useChunked && opt.Concurrency == 0 {
				opt.Concurrency = DefaultConcurrency
			}

			var err error
			if useChunked {
				err = client.ChunkedDownloadWithOptions(opt)
			} else {
				hash := opt.ExpectedHash
				if hash != "" {
					err = client.Download(opt.URL, opt.FilePath, hash)
				} else {
					err = client.Download(opt.URL, opt.FilePath)
				}
			}

			if err != nil {
				slog.Error("WFastDownload: file failed",
					"file", filepath.Base(opt.FilePath),
					"error", err,
				)
				errCh <- err
			} else {
				mu.Lock()
				completed++
				slog.Info("WFastDownload: file done",
					"file", filepath.Base(opt.FilePath),
					"completed", completed,
					"total", total,
				)
				if progressFn != nil {
					progressFn(total, completed, opt.FilePath)
				}
				mu.Unlock()
			}
		}(item)
	}

	wg.Wait()
	close(errCh)

	var errors []error
	for err := range errCh {
		errors = append(errors, err)
	}

	if len(errors) > 0 {
		return fmt.Errorf("wfastdownload completed with %d errors: %v", len(errors), errors[0])
	}

	return nil
}

// CalculateSHA1 computes the SHA1 hash of a file and returns it as a lowercase hex string.
func CalculateSHA1(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha1.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

// VerifySHA1 checks whether a file's SHA1 hash matches the expected value.
func VerifySHA1(filePath, expectedHash string) bool {
	hash, err := CalculateSHA1(filePath)
	if err != nil {
		return false
	}
	return strings.EqualFold(hash, expectedHash)
}

// firstOrEmpty returns the first string or empty string.
func firstOrEmpty(ss []string) string {
	if len(ss) > 0 {
		return ss[0]
	}
	return ""
}
