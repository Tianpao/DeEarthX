package download

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
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
	client.SetTimeout(5 * time.Minute)
	client.SetRetryCount(3)
	client.SetRetryWaitTime(2 * time.Second)
	client.SetRetryMaxWaitTime(30 * time.Second)
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
				util.Logger.Warn("已有文件校验失败，重新下载: " + opts.FilePath)
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

	util.Logger.Debug("[下载] 开始",
		"地址", opts.URL,
		"文件", filepath.Base(opts.FilePath),
		"分块", opts.UseChunked)

	var err error
	if opts.UseChunked {
		err = dc.chunkedDownload(opts.URL, opts.FilePath, opts.ExtraHeaders)
	} else {
		err = dc.simpleDownload(opts.URL, opts.FilePath, opts.ExtraHeaders)
	}

	if err != nil {
		util.Logger.Error("[下载] 失败",
			"地址", opts.URL,
			"文件", filepath.Base(opts.FilePath),
			"错误", err.Error())
		os.Remove(opts.FilePath)
		os.Remove(tempPath)
		return err
	}

	if opts.ExpectedHash != "" {
		ok, err := VerifySHA1(opts.FilePath, opts.ExpectedHash)
		if err != nil {
			util.Logger.Error("[下载] 哈希校验出错", "错误", err.Error())
			return err
		}
		if !ok {
			util.Logger.Error("[下载] 哈希不匹配", "文件", opts.FilePath)
			os.Remove(opts.FilePath)
			return fmt.Errorf("file hash verification failed")
		}
	}

	util.Logger.Debug("[下载] 完成",
		"地址", opts.URL,
		"文件", filepath.Base(opts.FilePath))
	return nil
}

func (dc *DownloadClient) simpleDownload(url, filePath string, headers map[string]string) error {
	tempPath := filePath + ".downloading"
	os.Remove(tempPath)

	req := dc.client.R().SetResponseDoNotParse(true)
	if headers != nil {
		for k, v := range headers {
			req.SetHeader(k, v)
		}
	}

	resp, err := req.Get(url)
	if err != nil {
		util.Logger.Error("[下载] 请求失败", "地址", url, "错误", err.Error())
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode() >= 400 {
		util.Logger.Error("[下载] HTTP 错误", "地址", url, "状态", resp.StatusCode())
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode(), resp.Status())
	}

	f, err := os.Create(tempPath)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(f, resp.Body)
	closeErr := f.Close()
	if copyErr != nil {
		os.Remove(tempPath)
		return copyErr
	}
	if closeErr != nil {
		os.Remove(tempPath)
		return closeErr
	}

	if err := os.Rename(tempPath, filePath); err != nil {
		os.Remove(tempPath)
		return err
	}
	return nil
}

func retryBackoff(attempt int) time.Duration {
	d := time.Duration(2*(1<<uint(attempt))) * time.Second
	if d > 30*time.Second {
		return 30 * time.Second
	}
	return d
}

func (dc *DownloadClient) chunkedDownload(url, filePath string, headers map[string]string) error {
	tempPath := filePath + ".downloading"
	useMCIMirror := IsMCIMirrorURL(url)
	chunkSize := int64(1 * 1024 * 1024)
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
		util.Logger.Debug("[下载] HEAD 探测失败，改用普通下载", "地址", url)
		return dc.simpleDownload(url, filePath, headers)
	}

	fileSize := int64(0)
	contentLength := resp.Header().Get("Content-Length")
	if contentLength != "" {
		fileSize, _ = strconv.ParseInt(contentLength, 10, 64)
	}
	acceptRanges := strings.EqualFold(resp.Header().Get("Accept-Ranges"), "bytes")

	minChunkedSize := chunkSize
	if useMCIMirror {
		minChunkedSize = 256 * 1024
	}
	if !acceptRanges || fileSize < minChunkedSize {
		util.Logger.Debug("[下载] 不支持分块或文件较小，改用普通下载",
			"地址", url, "大小", fileSize, "支持Range", acceptRanges)
		return dc.simpleDownload(url, filePath, headers)
	}

	totalChunks := int((fileSize + chunkSize - 1) / chunkSize)
	util.Logger.Debug("[下载] 分块开始",
		"地址", url, "大小MB", fmt.Sprintf("%.1f", float64(fileSize)/1024/1024), "块数", totalChunks)

	f, err := os.Create(tempPath)
	if err != nil {
		return err
	}
	f.Truncate(fileSize)

	sem := make(chan struct{}, chunkConcurrency)
	var wg sync.WaitGroup
	errChan := make(chan error, totalChunks)
	var rangeUnsupported atomic.Bool

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
						time.Sleep(retryBackoff(attempt))
						continue
					}
					errChan <- fmt.Errorf("chunk %d failed after 5 attempts: %w", idx, err)
					return
				}

				if resp.StatusCode() == 206 {
					f.WriteAt(resp.Bytes(), start)
					return
				}

				if resp.StatusCode() == 429 {
					time.Sleep(retryBackoff(attempt))
					continue
				}

				rangeUnsupported.Store(true)
				errChan <- fmt.Errorf("chunk %d: server returned HTTP %d", idx, resp.StatusCode())
				return
			}
			errChan <- fmt.Errorf("chunk %d failed after 5 attempts", idx)
		}(chunkIdx)
	}

	wg.Wait()
	close(errChan)
	f.Close()

	var firstErr error
	for err := range errChan {
		if err != nil && firstErr == nil {
			firstErr = err
		}
	}

	if firstErr != nil {
		os.Remove(tempPath)
		util.Logger.Warn("[下载] 分块失败，改用普通下载",
			"地址", url, "错误", firstErr.Error(), "不支持Range", rangeUnsupported.Load())
		return dc.simpleDownload(url, filePath, headers)
	}

	if err := os.Rename(tempPath, filePath); err != nil {
		util.Logger.Error("[下载] 分块文件重命名失败", "临时文件", tempPath, "目标", filePath, "错误", err.Error())
		return err
	}
	util.Logger.Debug("[下载] 分块完成", "地址", url)
	return nil
}

func (dc *DownloadClient) BatchDownload(items []DownloadOptions, concurrency int, progress ProgressCallback) error {
	util.Logger.Debug("[批量下载] 开始并行下载",
		"文件数", len(items),
		"并发", concurrency)
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
