package utils

func NewMemoryCache() *MemoryCache {
	return &MemoryCache{
		items: make(map[string]any),
	}
}

type MemoryCache struct {
	items map[string]any
}

func (super *MemoryCache) Get(k string) any {
	item, ok := super.items[k]
	if !ok {
		return nil
	}
	return item
}

func (super *MemoryCache) Set(k string, v any) {
	super.items[k] = v
}

func (super *MemoryCache) Has(k string) bool {
	_, ok := super.items[k]
	return ok
}
