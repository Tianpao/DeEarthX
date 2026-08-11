package strategies

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"dex/backend/platform"

	"resty.dev/v3"
)

// curseForgeGameID is the CurseForge Minecraft game ID used by the fingerprints API.
const curseForgeGameID = 432

// fingerprintBatchSize caps the fingerprints sent per request. The CurseForge
// fingerprints endpoint is slow to process large batches server-side, so keeping
// requests small keeps them inside the timeout.
const fingerprintBatchSize = 100

// fingerprintRetries is how many times a failed batch is retried before giving up.
const fingerprintRetries = 3

// FingerprintMatch is the subset of the CurseForge fingerprints response we use.
type FingerprintMatch struct {
	ModID        int
	GameVersions []string
}

// ResolveFingerprints resolves CurseForge fingerprints in small concurrent batches
// and returns a map from file fingerprint to match. It is the single entry point
// shared by the CurseForge and Mcmod filters so the slow API is hit only once.
func ResolveFingerprints(fingerprints []uint32) map[uint32]FingerprintMatch {
	result := make(map[uint32]FingerprintMatch)
	if len(fingerprints) == 0 {
		return result
	}

	urls := platform.GetMirrorUrls()
	client := newFingerprintClient()

	var mu sync.Mutex
	sem := make(chan struct{}, 4)
	var wg sync.WaitGroup

	for len(fingerprints) > 0 {
		n := fingerprintBatchSize
		if len(fingerprints) < n {
			n = len(fingerprints)
		}
		batch := fingerprints[:n]
		fingerprints = fingerprints[n:]

		wg.Add(1)
		sem <- struct{}{}
		go func(batch []uint32) {
			defer wg.Done()
			defer func() { <-sem }()
			for fp, match := range queryFingerprintBatch(client, urls.CurseForgeURL, batch) {
				mu.Lock()
				result[fp] = match
				mu.Unlock()
			}
		}(batch)
	}
	wg.Wait()
	return result
}

// newFingerprintClient builds the shared CurseForge API client. The timeout is
// generous because the fingerprints endpoint is slow under load.
func newFingerprintClient() *resty.Client {
	return resty.New().
		SetHeader("User-Agent", "DeEarthX").
		SetHeader("x-api-key", platform.CurseForgeAPIKey).
		SetHeader("Content-Type", "application/json").
		SetHeader("Accept", "application/json").
		SetTimeout(60 * time.Second)
}

// queryFingerprintBatch posts one batch of fingerprints and returns the matches,
// retrying transient failures a few times.
func queryFingerprintBatch(client *resty.Client, baseURL string, batch []uint32) map[uint32]FingerprintMatch {
	for attempt := 0; attempt < fingerprintRetries; attempt++ {
		resp, err := client.R().
			SetBody(map[string]any{"fingerprints": batch}).
			Post(baseURL + "/v1/fingerprints/" + fmt.Sprintf("%d", curseForgeGameID))
		if err == nil && resp.StatusCode() < 400 {
			var response struct {
				Data struct {
					ExactMatches []struct {
						File struct {
							FileFingerprint uint32 `json:"fileFingerprint"`
							ModID           int    `json:"modId"`
						} `json:"file"`
						LatestFiles []struct {
							GameVersions []string `json:"gameVersions"`
						} `json:"latestFiles"`
					} `json:"exactMatches"`
				} `json:"data"`
			}
			if err := json.Unmarshal(resp.Bytes(), &response); err != nil {
				slog.Warn("CurseForge fingerprints: failed to parse response", "error", err)
				return nil
			}
			m := make(map[uint32]FingerprintMatch, len(response.Data.ExactMatches))
			for _, match := range response.Data.ExactMatches {
				var versions []string
				if len(match.LatestFiles) > 0 {
					versions = match.LatestFiles[0].GameVersions
				}
				m[match.File.FileFingerprint] = FingerprintMatch{
					ModID:        match.File.ModID,
					GameVersions: versions,
				}
			}
			return m
		}
		if err != nil {
			slog.Warn("CurseForge fingerprints: API error (retrying)", "attempt", attempt+1, "error", err)
		} else {
			slog.Warn("CurseForge fingerprints: HTTP error (retrying)", "attempt", attempt+1, "status", resp.StatusCode())
		}
		time.Sleep(time.Duration(attempt+1) * 300 * time.Millisecond)
	}
	return nil
}
