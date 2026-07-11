package download

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"resty.dev/v3"

	"deearthx/core/util"
)

type DownloadOptions struct {
	URL          string
	FilePath     string
	ExpectedHash string
	Force        bool
	UseChunked   bool
	ExtraHeaders map[string]string
}

type ProgressCallback func(total int, current int, name string)

type DownloadClient struct {
	client *resty.Client
}

func NewDownloadClient() *DownloadClient {
	client := resty.NewWithTransportSettings(&resty.TransportSettings{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 16,
	})
	client.SetTimeout(60 * time.Second)
	client.SetRetryCount(3)
	client.SetRetryWaitTime(5 * time.Second)
	client.SetRetryMaxWaitTime(60 * time.Second)
	client.SetHeader("User-Agent", "DeEarthX")
	return &DownloadClient{client: client}
}

func (dc *DownloadClient) DownloadFile(opts DownloadOptions, progress ProgressCallback) error {
	ctx := context.Background()
	return util.RetryWithContext(ctx, 5, 2*time.Second, func() error {
		return dc.downloadFileOnce(opts, progress)
	})
}

func (dc *DownloadClient) downloadFileOnce(opts DownloadOptions, progress ProgressCallback) error {
	if !opts.Force && fileExists(opts.FilePath) {
		if opts.ExpectedHash != "" {
			ok, err := VerifySHA1(opts.FilePath, opts.ExpectedHash)
			if err != nil {
				return err
			}
			if !ok {
				util.Logger.Warn("Existing file hash mismatch, re-downloading: " + opts.FilePath)
				os.Remove(opts.FilePath)
			} else {
				return nil
			}
		} else {
			return nil
		}
	}

	dir := filepath.Dir(opts.FilePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	tempPath := opts.FilePath + ".downloading"
	os.Remove(tempPath)

	util.Logger.Info("[Download] Starting",
		"url", opts.URL,
		"file", filepath.Base(opts.FilePath),
		"chunked", opts.UseChunked)

	var err error
	if opts.UseChunked {
		err = dc.chunkedDownload(opts.URL, opts.FilePath, opts.ExtraHeaders)
	} else {
		err = dc.simpleDownload(opts.URL, opts.FilePath, opts.ExtraHeaders)
	}

	if err != nil {
		util.Logger.Error("[Download] FAILED",
			"url", opts.URL,
			"file", filepath.Base(opts.FilePath),
			"error", err.Error())
		os.Remove(opts.FilePath)
		os.Remove(tempPath)
		return err
	}

	if opts.ExpectedHash != "" {
		ok, err := VerifySHA1(opts.FilePath, opts.ExpectedHash)
		if err != nil {
			util.Logger.Error("[Download] Hash verify failed", "error", err.Error())
			return err
		}
		if !ok {
			util.Logger.Error("[Download] Hash mismatch", "file", opts.FilePath)
			os.Remove(opts.FilePath)
			return fmt.Errorf("file hash verification failed")
		}
	}

	util.Logger.Info("[Download] Complete",
		"url", opts.URL,
		"file", filepath.Base(opts.FilePath))
	return nil
}

func (dc *DownloadClient) simpleDownload(url, filePath string, headers map[string]string) error {
	req := dc.client.R()
	if headers != nil {
		for k, v := range headers {
			req.SetHeader(k, v)
		}
	}

	resp, err := req.Get(url)
	if err != nil {
		util.Logger.Error("[Download] HTTP GET failed", "url", url, "error", err.Error())
		return err
	}

	if resp.StatusCode() >= 400 {
		util.Logger.Error("[Download] HTTP error", "url", url, "status", resp.StatusCode())
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode(), resp.Status())
	}

	return os.WriteFile(filePath, resp.Bytes(), 0644)
}

func (dc *DownloadClient) chunkedDownload(url, filePath string, headers map[string]string) error {
	tempPath := filePath + ".downloading"
	useMCIMirror := IsMCIMirrorURL(url)
	chunkSize := int64(1 * 1024 * 1024) // 1MB chunks for better progress granularity
	chunkConcurrency := 8
	if useMCIMirror {
		chunkSize = 128 * 1024
		chunkConcurrency = 64
	}

	req := dc.client.R()
	if headers != nil {
		for k, v := range headers {
			req.SetHeader(k, v)
		}
	}

	resp, err := req.Head(url)
	if err != nil {
		util.Logger.Info("[Download] HEAD probe failed, fallback to simple", "url", url)
		return dc.simpleDownload(url, filePath, headers)
	}

	fileSize := int64(0)
	contentLength := resp.Header().Get("Content-Length")
	if contentLength != "" {
		fileSize, _ = strconv.ParseInt(contentLength, 10, 64)
	}

	// Files smaller than one chunk don't benefit from chunked download
	if fileSize < chunkSize {
		util.Logger.Info("[Download] File too small for chunked, using simple", "url", url, "size", fileSize)
		return dc.simpleDownload(url, filePath, headers)
	}

	totalChunks := int((fileSize + chunkSize - 1) / chunkSize)
	util.Logger.Info("[Download] Chunked start",
		"url", url, "sizeMB", fmt.Sprintf("%.1f", float64(fileSize)/1024/1024), "chunks", totalChunks)

	f, err := os.Create(tempPath)
	if err != nil {
		return err
	}
	f.Truncate(fileSize)
	defer f.Close()

	sem := make(chan struct{}, chunkConcurrency)
	var wg sync.WaitGroup
	errChan := make(chan error, totalChunks)
	rangeSupported := true

	for chunkIdx := 0; chunkIdx < totalChunks; chunkIdx++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			start := int64(idx) * chunkSize
			end := min(start+chunkSize-1, fileSize-1)

			for attempt := 1; attempt <= 5; attempt++ {
				req := dc.client.R()
				if headers != nil {
					for k, v := range headers {
						req.SetHeader(k, v)
					}
				}
				req.SetHeader("Range", fmt.Sprintf("bytes=%d-%d", start, end))

				resp, err := req.Get(url)
				if err != nil {
					if attempt < 5 {
						time.Sleep(time.Duration(5*(1<<attempt)) * time.Second)
						continue
					}
					errChan <- err
					return
				}

				if resp.StatusCode() == 206 {
					f.WriteAt(resp.Bytes(), start)
					return
				}

				if resp.StatusCode() == 429 {
					time.Sleep(time.Duration(5*(1<<attempt)) * time.Second)
					continue
				}

				rangeSupported = false
				errChan <- fmt.Errorf("server returned HTTP %d", resp.StatusCode())
				return
			}
			errChan <- fmt.Errorf("chunk %d failed after 5 attempts", idx)
		}(chunkIdx)
	}

	wg.Wait()
	close(errChan)

	for err := range errChan {
		if err != nil && !rangeSupported {
			os.Remove(tempPath)
			return dc.simpleDownload(url, filePath, headers)
		}
		if err != nil {
			os.Remove(tempPath)
			return err
		}
	}

	f.Close()
	if err := os.Rename(tempPath, filePath); err != nil {
		util.Logger.Error("[Download] Chunked rename failed", "temp", tempPath, "target", filePath, "error", err.Error())
		return err
	}
	util.Logger.Info("[Download] Chunked complete", "url", url)
	return nil
}

func (dc *DownloadClient) BatchDownload(items []DownloadOptions, concurrency int, progress ProgressCallback) error {
	util.Logger.Info("[BatchDownload] Starting parallel download",
		"fileCount", len(items),
		"concurrency", concurrency)
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	errChan := make(chan error, len(items))
	completed := make(map[int]bool)
	var completedMutex sync.Mutex

	for idx, item := range items {
		wg.Add(1)
		go func(i int, opts DownloadOptions) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			err := dc.DownloadFile(opts, nil)
			if err != nil {
				errChan <- err
				return
			}
			completedMutex.Lock()
			completed[i] = true
			completedMutex.Unlock()

			if progress != nil {
				progress(len(items), len(completed), filepath.Base(opts.FilePath))
			}
		}(idx, item)
	}

	wg.Wait()
	close(errChan)

	for err := range errChan {
		if err != nil {
			return err
		}
	}
	return nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func containsSubstring(s, substr string) bool {
	return strings.Contains(s, substr)
}

func min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
