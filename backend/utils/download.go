package utils

import "resty.dev/v3"

type DownloadOption struct {
	URL          string
	FilePath     string
	ExpectedHash string
}

func NewDownloadClient() *DownloadClient {
	client := resty.New().SetHeader("User-Agent", "DeEarthX").SetRetryCount(3).SetTimeout(60)
	return &DownloadClient{
		client: client,
	}
}

type DownloadClient struct {
	client *resty.Client
}
