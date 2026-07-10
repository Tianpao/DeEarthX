package strategies

// FileInfo contains extracted mod file information for strategy filtering
type FileInfo struct {
	Filename string      `json:"filename"`
	Hash     string      `json:"hash"`
	Murmur2  *uint32     `json:"murmur2,omitempty"`
	Mixins   []MixinFile `json:"mixins"`
	Infos    []InfoFile  `json:"infos"`
	FileData []byte      `json:"-"`
}

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