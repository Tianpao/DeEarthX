package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"deearthx/core/util"
)

// MirrorConfig holds mirror configuration
type MirrorConfig struct {
	BMCLAPI   bool   `json:"bmclapi"`
	MCIMirror string `json:"mcimirror"` // "on" | "off" | "partial"
}

// FilterConfig holds filter strategy configuration
type FilterConfig struct {
	Hashes   bool `json:"hashes"`
	Dexpub   bool `json:"dexpub"`
	Mixins   bool `json:"mixins"`
	Modrinth bool `json:"modrinth"`
	Mcmod    bool `json:"mcmod"`
}

// IConfig is the main configuration structure
type IConfig struct {
	Mirror        MirrorConfig `json:"mirror"`
	Filter        FilterConfig `json:"filter"`
	OAF           bool         `json:"oaf"`
	AutoZip       bool         `json:"autoZip"`
	ShowSponsorAd bool         `json:"showSponsorAd"`
	Port          int          `json:"port,omitempty"`
	Host          string       `json:"host,omitempty"`
	JavaPath      string       `json:"javaPath,omitempty"`
}

// Default configuration values
var defaultConfig = IConfig{
	Mirror: MirrorConfig{
		BMCLAPI:   true,
		MCIMirror: "on",
	},
	Filter: FilterConfig{
		Hashes:   false,
		Dexpub:   false,
		Mixins:   false,
		Modrinth: false,
		Mcmod:    false,
	},
	OAF:           false,
	AutoZip:       false,
	ShowSponsorAd: true,
	Port:          37019,
	Host:          "localhost",
}

// cachedConfig holds the loaded configuration
var cachedConfig *IConfig

// configPath is the path to the config file
var configPath string

// InitConfig initializes the config path
func InitConfig() {
	configPath = filepath.Join(util.GetAppDir(), "config.json")
}

// normalizeMcimirror validates and normalizes mcimirror value
func normalizeMcimirror(value string) string {
	if value == "on" || value == "off" || value == "partial" {
		return value
	}
	// Handle legacy boolean values
	if strings.ToLower(value) == "true" {
		return "on"
	}
	if strings.ToLower(value) == "false" {
		return "off"
	}
	return "on"
}

// getEnv retrieves a value from environment variable with fallback
func getEnvBool(key string, defaultVal bool) bool {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	return strings.ToLower(val) == "true"
}

func getEnvInt(key string, defaultVal int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	num, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}
	return num
}

func getEnvString(key string, defaultVal string) string {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	return val
}

// GetConfig returns the current configuration
func GetConfig() *IConfig {
	if cachedConfig != nil {
		return cachedConfig
	}

	var config IConfig

	// Read config file
	data, err := os.ReadFile(configPath)
	if err != nil {
		// Config file doesn't exist, create default
		config = defaultConfig
		saveConfigFile(&config)
	} else {
		err = json.Unmarshal(data, &config)
		if err != nil {
			util.Logger.Error(fmt.Sprintf("Failed to parse config file: %v", err))
			config = defaultConfig
		}
	}

	// Apply environment variable overrides
	mcimirror := getEnvString("DEEARTHX_MIRROR_MCIMIRROR", config.Mirror.MCIMirror)
	envConfig := IConfig{
		Mirror: MirrorConfig{
			BMCLAPI:   getEnvBool("DEEARTHX_MIRROR_BMCLAPI", config.Mirror.BMCLAPI),
			MCIMirror: normalizeMcimirror(mcimirror),
		},
		Filter: FilterConfig{
			Hashes:   getEnvBool("DEEARTHX_FILTER_HASHES", config.Filter.Hashes),
			Dexpub:   getEnvBool("DEEARTHX_FILTER_DEXPUB", config.Filter.Dexpub),
			Mixins:   getEnvBool("DEEARTHX_FILTER_MIXINS", config.Filter.Mixins),
			Modrinth: getEnvBool("DEEARTHX_FILTER_MODRINTH", config.Filter.Modrinth),
			Mcmod:    getEnvBool("DEEARTHX_FILTER_MCMOD", config.Filter.Mcmod),
		},
		OAF:           getEnvBool("DEEARTHX_OAF", config.OAF),
		AutoZip:       getEnvBool("DEEARTHX_AUTO_ZIP", config.AutoZip),
		ShowSponsorAd: getEnvBool("DEEARTHX_SHOW_SPONSOR_AD", config.ShowSponsorAd),
		Port:          getEnvInt("DEEARTHX_PORT", config.Port),
		Host:          getEnvString("DEEARTHX_HOST", config.Host),
		JavaPath:      getEnvString("DEEARTHX_JAVA_PATH", config.JavaPath),
	}

	cachedConfig = &envConfig
	util.Logger.Debug(fmt.Sprintf("Loaded config: %+v", envConfig))
	return cachedConfig
}

// SaveConfig writes the configuration to file
func SaveConfig(config *IConfig) error {
	err := saveConfigFile(config)
	if err != nil {
		return err
	}
	cachedConfig = config
	util.Logger.Info("Config saved successfully")
	return nil
}

func saveConfigFile(config *IConfig) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	return os.WriteFile(configPath, data, 0644)
}

// ClearCache clears the cached configuration
func ClearCache() {
	cachedConfig = nil
}

// GetTemplatePath returns the path to a template directory
func (c *IConfig) GetTemplatePath(templateID string) string {
	return filepath.Join(util.GetAppDir(), "templates", templateID)
}

// GetInstancePath returns the path to an instance directory
func (c *IConfig) GetInstancePath(instanceName string) string {
	return filepath.Join(util.GetAppDir(), "instance", instanceName)
}