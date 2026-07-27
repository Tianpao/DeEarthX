package utils

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"

	"resty.dev/v3"
)

type DownloadOption struct {
	URL          string
	FilePath     string
	ExpectedHash string
}

func NewDownloadClient() *DownloadClient {
	client := resty.New().
		SetHeader("User-Agent", "DeEarthX").
		SetRetryCount(3).
		SetTimeout(60)
	return &DownloadClient{
		client: client,
	}
}

type DownloadClient struct {
	client *resty.Client
}

// Download downloads a file from url to filePath, optionally verifying SHA1 hash.
func (dc *DownloadClient) Download(url, filePath string, expectedHash ...string) error {
	// Ensure parent directory exists
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	resp, err := dc.client.R().Get(url)
	if err != nil {
		return fmt.Errorf("download failed for %s: %w", url, err)
	}
	if resp.StatusCode() >= 400 {
		return fmt.Errorf("download failed for %s: HTTP %d", url, resp.StatusCode())
	}

	data := resp.Bytes()
	if err := os.WriteFile(filePath, data, 0o644); err != nil {
		return fmt.Errorf("failed to write file %s: %w", filePath, err)
	}

	// Verify SHA1 if provided
	if len(expectedHash) > 0 && expectedHash[0] != "" {
		if !VerifySHA1(filePath, expectedHash[0]) {
			return fmt.Errorf("SHA1 verification failed for %s", filePath)
		}
	}

	return nil
}

// FastDownload downloads multiple files concurrently using a worker pool.
// Each item is a DownloadOption with URL, FilePath, and optional ExpectedHash.
func FastDownload(items []DownloadOption) error {
	if len(items) == 0 {
		return nil
	}

	client := NewDownloadClient()

	var wg sync.WaitGroup
	errCh := make(chan error, len(items))
	semaphore := make(chan struct{}, 8) // 8 concurrent downloads

	for _, item := range items {
		wg.Add(1)
		go func(opt DownloadOption) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			if err := client.Download(opt.URL, opt.FilePath, opt.ExpectedHash); err != nil {
				errCh <- err
			}
		}(item)
	}

	wg.Wait()
	close(errCh)

	// Collect errors
	var errors []error
	for err := range errCh {
		errors = append(errors, err)
	}

	if len(errors) > 0 {
		return fmt.Errorf("fastdownload completed with %d errors: %v", len(errors), errors[0])
	}

	return nil
}

// CalculateSHA1 computes the SHA1 hash of a file and returns it as a hex string.
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
	return hash == expectedHash
}
