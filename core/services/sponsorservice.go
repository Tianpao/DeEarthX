package services

import "deearthx/core/sponsor"

// SponsorService handles sponsor operations
type SponsorService struct {
	ss *sponsor.SponsorService
}

// NewSponsorService creates a new SponsorService
func NewSponsorService() *SponsorService {
	return &SponsorService{
		ss: sponsor.NewSponsorService(),
	}
}

// List returns all sponsors
func (s *SponsorService) List() ([]sponsor.Sponsor, error) {
	return s.ss.List()
}