package dearth

// ModSide represents mod compatibility type
type ModSide string

const (
	ModSideRequired   ModSide = "required"
	ModSideOptional   ModSide = "optional"
	ModSideUnsupported ModSide = "unsupported"
	ModSideUnknown    ModSide = "unknown"
)

// MixinFile represents a mixin config file
type MixinFile struct {
	Name string `json:"name"`
	Data string `json:"data"`
}

// InfoFile represents a mod info file
type InfoFile struct {
	Name string `json:"name"`
	Data string `json:"data"`
}

// FileInfo contains extracted mod file information
type FileInfo struct {
	Filename string      `json:"filename"`
	Hash     string      `json:"hash"`
	Murmur2  *uint32     `json:"murmur2,omitempty"`
	Mixins   []MixinFile `json:"mixins"`
	Infos    []InfoFile  `json:"infos"`
	FileData []byte      `json:"-"`
}

// FilterConfig holds filter strategy configuration
type FilterConfig struct {
	Hashes   bool `json:"hashes"`
	Dexpub   bool `json:"dexpub"`
	Mixins   bool `json:"mixins"`
	Modrinth bool `json:"modrinth"`
	Mcmod    bool `json:"mcmod"`
}

// SingleCheckResult represents result from a single check method
type SingleCheckResult struct {
	Source     string  `json:"source"`
	ClientSide ModSide `json:"clientSide"`
	ServerSide ModSide `json:"serverSide"`
	Checked    bool    `json:"checked"`
	Error      string  `json:"error,omitempty"`
}

// ModCheckResult represents comprehensive mod check result
type ModCheckResult struct {
	Filename    string              `json:"filename"`
	FilePath    string              `json:"filePath"`
	ClientSide  ModSide             `json:"clientSide"`
	ServerSide  ModSide             `json:"serverSide"`
	Source      string              `json:"source"`
	Checked     bool                `json:"checked"`
	Errors      []string            `json:"errors,omitempty"`
	AllResults  []SingleCheckResult `json:"allResults"`
	ModID       string              `json:"modId,omitempty"`
	IconURL     string              `json:"iconUrl,omitempty"`
	Description string              `json:"description,omitempty"`
	Author      string              `json:"author,omitempty"`
}

// ModCheckConfig holds mod check configuration
type ModCheckConfig struct {
	EnableDexpub   bool `json:"enableDexpub"`
	EnableModrinth bool `json:"enableModrinth"`
	EnableMcmod    bool `json:"enableMcmod"`
	EnableMixin    bool `json:"enableMixin"`
	EnableHash     bool `json:"enableHash"`
	Timeout        int  `json:"timeout"` // milliseconds
}

// DexpubCheckResult represents Galaxy Square check result
type DexpubCheckResult struct {
	ServerMods []string `json:"serverMods"`
	ClientMods []string `json:"clientMods"`
}

// HashResponse represents Modrinth hash response
type HashResponse map[string]struct {
	ProjectID string `json:"project_id"`
}

// ProjectInfo represents Modrinth project info
type ProjectInfo struct {
	ID          string `json:"id"`
	ClientSide  string `json:"client_side"`
	ServerSide  string `json:"server_side"`
}

// IFilterStrategy defines the filter strategy interface
type IFilterStrategy interface {
	Name() string
	Filter(files []FileInfo) ([]string, error)
}