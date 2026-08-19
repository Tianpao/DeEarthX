package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

var GlobalConfig *ConfigService

func NewConfigService() *ConfigService {
	cs := &ConfigService{
		data:     make(map[string]any),
		filePath: "",
	}
	GlobalConfig = cs
	return cs
}

type ConfigService struct {
	data     map[string]any
	filePath string
	mu       sync.RWMutex
}

// LoadConfig parses a JSON string into the in-memory config.
// This is the Wails-bound method called from the frontend.
func (c *ConfigService) LoadConfig(configData string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	var parsed map[string]any
	if err := json.Unmarshal([]byte(configData), &parsed); err != nil {
		return err
	}
	c.data = parsed

	// Persist to disk if we know the file path
	if c.filePath != "" {
		return c.saveLocked()
	}
	return nil
}

// LoadConfigFromDisk reads config.json from the given directory.
// If the file doesn't exist, it initializes with defaults.
func (c *ConfigService) LoadConfigFromDisk(dir string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	configPath := filepath.Join(dir, "config.json")
	c.filePath = configPath

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			// No config file yet — keep current in-memory data
			// (may have been populated by the frontend already)
			if len(c.data) == 0 {
				c.data = defaultConfig()
			}
			// Create the file so subsequent saves have a target
			_ = c.saveLocked()
			return nil
		}
		return fmt.Errorf("failed to read config file: %w", err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		return fmt.Errorf("failed to parse config file: %w", err)
	}

	// Merge: disk values override in-memory defaults, but any
	// keys present only in memory (e.g. from frontend) are kept.
	c.data = mergeConfig(c.data, parsed)

	return nil
}

// SaveConfig writes the current in-memory config to disk.
func (c *ConfigService) SaveConfig() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.saveLocked()
}

// saveLocked writes the config to disk. Caller must hold c.mu.
func (c *ConfigService) saveLocked() error {
	if c.filePath == "" {
		return nil // no path set yet
	}

	b, err := json.MarshalIndent(c.data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	dir := filepath.Dir(c.filePath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	return os.WriteFile(c.filePath, b, 0o644)
}

func (c *ConfigService) UpdateConfig(key string, value any) {
	c.mu.Lock()
	defer c.mu.Unlock()

	parts := strings.Split(key, ".")
	obj := c.data

	for i := 0; i < len(parts)-1; i++ {
		next, ok := obj[parts[i]]
		if !ok {
			newMap := make(map[string]any)
			obj[parts[i]] = newMap
			obj = newMap
		} else if m, ok := next.(map[string]any); ok {
			obj = m
		} else {
			newMap := make(map[string]any)
			obj[parts[i]] = newMap
			obj = newMap
		}
	}

	obj[parts[len(parts)-1]] = value
}

func (c *ConfigService) GetConfig() string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	b, err := json.Marshal(c.data)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func (c *ConfigService) GetConfigValue(key string) any {
	c.mu.RLock()
	defer c.mu.RUnlock()

	parts := strings.Split(key, ".")
	var value any = c.data

	for _, part := range parts {
		m, ok := value.(map[string]any)
		if !ok {
			return nil
		}
		value, ok = m[part]
		if !ok {
			return nil
		}
	}

	return value
}

// --- Helpers ---

// defaultConfig returns the default configuration values.
func defaultConfig() map[string]any {
	return map[string]any{
		"mirror": map[string]any{
			"bmclapi":   true,
			"mcimirror": "partial",
		},
		"filter": map[string]any{
			"hashes":   true,
			"dexpub":   true,
			"mixins":   false,
			"modrinth": true,
			"mcmod":    true,
		},
		"oaf":           true,
		"showSponsorAd": true,
	}
}

// mergeConfig deep-merges src into dst. Values in src override dst.
func mergeConfig(dst, src map[string]any) map[string]any {
	result := make(map[string]any)
	for k, v := range dst {
		result[k] = v
	}
	for k, v := range src {
		if srcMap, ok := v.(map[string]any); ok {
			if dstMap, ok := result[k].(map[string]any); ok {
				result[k] = mergeConfig(dstMap, srcMap)
				continue
			}
		}
		result[k] = v
	}
	return result
}
