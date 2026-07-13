package utils

import (
	"encoding/json"
	"strings"
	"sync"
)

func NewConfigService() *ConfigService {
	return &ConfigService{
		data: make(map[string]any),
	}
}

type ConfigService struct {
	data map[string]any
	mu   sync.RWMutex
}

func (c *ConfigService) LoadConfig(configData string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	var parsed map[string]any
	if err := json.Unmarshal([]byte(configData), &parsed); err != nil {
		return err
	}
	c.data = parsed
	return nil
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
