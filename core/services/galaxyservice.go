package services

import (
	"deearthx/core/galaxy"
)

// GalaxyService handles Galaxy Square operations
type GalaxyService struct {
	g *galaxy.Galaxy
}

// NewGalaxyService creates a new GalaxyService
func NewGalaxyService() *GalaxyService {
	return &GalaxyService{
		g: galaxy.NewGalaxy(),
	}
}

// UploadModsFromPaths extracts mod IDs from file paths
func (s *GalaxyService) UploadModsFromPaths(paths []string) ([]string, error) {
	return s.g.UploadModsFromPaths(paths)
}

// SubmitModIDs submits mod IDs to Galaxy Square
func (s *GalaxyService) SubmitModIDs(modType string, modIDs []string) error {
	return s.g.SubmitModIDs(modType, modIDs)
}