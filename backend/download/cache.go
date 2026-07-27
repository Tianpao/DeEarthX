package download

import (
	"sync"
	"time"
)

type cacheEntry struct {
	data      any
	expiresAt time.Time
}

// VersionCache is a thread-safe cache with TTL for version list data.
type VersionCache struct {
	mu    sync.RWMutex
	items map[string]cacheEntry
	ttl   time.Duration
}

// NewVersionCache creates a VersionCache with the given TTL.
func NewVersionCache(ttl time.Duration) *VersionCache {
	return &VersionCache{
		items: make(map[string]cacheEntry),
		ttl:   ttl,
	}
}

// Get retrieves a cached value by key. Returns (nil, false) if not found or expired.
func (c *VersionCache) Get(key string) (any, bool) {
	c.mu.RLock()
	entry, ok := c.items[key]
	c.mu.RUnlock()

	if !ok {
		return nil, false
	}

	if time.Now().After(entry.expiresAt) {
		c.mu.Lock()
		delete(c.items, key)
		c.mu.Unlock()
		return nil, false
	}

	return entry.data, true
}

// Set stores a value in the cache with the configured TTL.
func (c *VersionCache) Set(key string, data any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = cacheEntry{
		data:      data,
		expiresAt: time.Now().Add(c.ttl),
	}
}
