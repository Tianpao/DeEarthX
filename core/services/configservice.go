package services

import "deearthx/core/config"

// ConfigService handles config operations
type ConfigService struct{}

// NewConfigService creates a new ConfigService
func NewConfigService() *ConfigService {
	return &ConfigService{}
}

// GetConfig returns the current configuration
func (s *ConfigService) GetConfig() *config.IConfig {
	return config.GetConfig()
}

// SaveConfig saves the configuration
func (s *ConfigService) SaveConfig(cfg *config.IConfig) error {
	return config.SaveConfig(cfg)
}