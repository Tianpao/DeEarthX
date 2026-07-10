package sponsor

import (
	"encoding/json"
	"sync"

	"resty.dev/v3"

	"deearthx/core/util"
)

// Sponsor represents a sponsor entry
type Sponsor struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	ImageURL string `json:"imageUrl"`
	URL      string `json:"url"`
	Tone     string `json:"tone"` // "gold" | "silver" | "bronze"
}

// SponsorService handles sponsor operations
type SponsorService struct {
	client      *resty.Client
	cache       []Sponsor
	cacheMutex  sync.RWMutex
}

// NewSponsorService creates a new SponsorService
func NewSponsorService() *SponsorService {
	return &SponsorService{
		client: resty.New().
			SetBaseURL("https://galaxy.tianpao.top/").
			SetHeader("User-Agent", "DeEarthX"),
	}
}

// List returns all sponsors
func (ss *SponsorService) List() ([]Sponsor, error) {
	// Check cache first
	ss.cacheMutex.RLock()
	if ss.cache != nil {
		ss.cacheMutex.RUnlock()
		util.Logger.Debug("Returning cached sponsors", "count", len(ss.cache))
		return ss.cache, nil
	}
	ss.cacheMutex.RUnlock()

	// Fetch from API
	resp, err := ss.client.R().Get("sponsor/")
	if err != nil {
		util.Logger.Error("Failed to get sponsors: " + err.Error())
		return nil, err
	}

	if resp.StatusCode() >= 400 {
		util.Logger.Error("Sponsor API error: HTTP " + resp.Status())
		return nil, nil
	}

	contentType := resp.Header().Get("Content-Type")
	if contentType != "" && len(contentType) >= 16 && contentType[:16] != "application/json" {
		util.Logger.Warn("Sponsor API returned non-JSON response", "contentType", contentType)
		return nil, nil
	}

	var sponsors []Sponsor
	if err := json.Unmarshal(resp.Bytes(), &sponsors); err != nil {
		util.Logger.Warn("Failed to parse sponsor response", "error", err.Error())
		return nil, nil
	}

	// Cache result
	ss.cacheMutex.Lock()
	ss.cache = sponsors
	ss.cacheMutex.Unlock()

	util.Logger.Info("Fetched sponsors", "count", len(sponsors))
	return sponsors, nil
}

// ClearCache clears the sponsor cache
func (ss *SponsorService) ClearCache() {
	ss.cacheMutex.Lock()
	ss.cache = nil
	ss.cacheMutex.Unlock()
}
