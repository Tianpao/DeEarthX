package template

// TemplateMetadata describes a server template
type TemplateMetadata struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
	Author      string `json:"author"`
	Created     string `json:"created"`
	Type        string `json:"type"`
}
