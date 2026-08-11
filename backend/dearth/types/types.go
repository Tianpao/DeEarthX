package types

// MixinClass represents the bytecode of a mixin class referenced by a mixin config.
type MixinClass struct {
	Name  string `json:"name"`
	Bytes []byte `json:"-"`
}

// MixinFile represents a mixin configuration file extracted from a jar.
type MixinFile struct {
	Name    string       `json:"name"`
	Data    string       `json:"data"`
	Classes []MixinClass `json:"-"`
}

// InfoFile represents a mod metadata file extracted from a jar.
type InfoFile struct {
	Name string `json:"name"`
	Data string `json:"data"`
}

// FileInfo is the core data unit for a mod jar file.
type FileInfo struct {
	Filename string      `json:"filename"`
	Hash     string      `json:"hash"`    // SHA1 hash
	Murmur2  uint32      `json:"murmur2"` // MurmurHash2 (CurseForge fingerprint)
	Mixins   []MixinFile `json:"mixins"`
	Infos    []InfoFile  `json:"infos"`
}

// FilterConfig controls which filter strategies are enabled.
type FilterConfig struct {
	Hashes   bool `json:"hashes"`
	Dexpub   bool `json:"dexpub"`
	Mixins   bool `json:"mixins"`
	Modrinth bool `json:"modrinth"`
	Mcmod    bool `json:"mcmod"`
}

// FilterStrategy is the interface that all filter strategies must implement.
type FilterStrategy interface {
	Name() string
	Filter(files []FileInfo) ([]string, error)
}

// DexpubCheckResult contains the result of a Galaxy Square (Dexpub) check.
type DexpubCheckResult struct {
	ServerMods []string `json:"serverMods"`
	ClientMods []string `json:"clientMods"`
}

// ModSide represents the compatibility side of a mod.
type ModSide string

const (
	ModSideRequired    ModSide = "required"
	ModSideOptional    ModSide = "optional"
	ModSideUnsupported ModSide = "unsupported"
	ModSideUnknown     ModSide = "unknown"
)

// MoveResult contains the result of moving client-side mods.
type MoveResult struct {
	Success int `json:"success"`
	Error   int `json:"error"`
	Skipped int `json:"skipped"`
}
