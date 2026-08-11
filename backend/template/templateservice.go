package template

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"dex/backend/utils"
)

// TemplateMetadata describes a server template.
type TemplateMetadata struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
	Author      string `json:"author"`
	Created     string `json:"created"`
	Type        string `json:"type"`
}

// Template is a template id paired with its metadata.
type Template struct {
	ID       string           `json:"id"`
	Metadata TemplateMetadata `json:"metadata"`
}

// TemplateService is the Wails service for managing server templates.
// Templates are stored under <appDir>/templates/<id>/ as metadata.json + a data/ folder.
type TemplateService struct {
	templatesPath string
}

// NewTemplateService creates a new TemplateService instance.
func NewTemplateService() *TemplateService {
	return &TemplateService{
		templatesPath: filepath.Join(utils.GetAppDir(), "templates"),
	}
}

// GetTemplates lists all templates sorted by creation (newest first).
func (s *TemplateService) GetTemplates() ([]Template, error) {
	entries, err := os.ReadDir(s.templatesPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []Template{}, nil
		}
		return nil, fmt.Errorf("failed to read templates directory: %w", err)
	}

	templates := []Template{}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		metadata, ok := s.readMetadata(entry.Name())
		if !ok {
			continue
		}
		templates = append(templates, Template{ID: entry.Name(), Metadata: metadata})
	}

	// Newest first (folder names embed a timestamp prefix).
	for i := 0; i < len(templates); i++ {
		for j := i + 1; j < len(templates); j++ {
			if templates[j].ID > templates[i].ID {
				templates[i], templates[j] = templates[j], templates[i]
			}
		}
	}
	return templates, nil
}

// CreateTemplate creates a new template and returns its id.
func (s *TemplateService) CreateTemplate(name, version, description, author string) (string, error) {
	id := fmt.Sprintf("template-%d-%s", time.Now().UnixMilli(), randStr(6))
	templatePath := filepath.Join(s.templatesPath, id)

	if err := os.MkdirAll(templatePath, 0o755); err != nil {
		return "", fmt.Errorf("failed to create template directory: %w", err)
	}

	metadata := TemplateMetadata{
		Name:        name,
		Version:     version,
		Description: description,
		Author:      author,
		Created:     time.Now().Format("2006-01-02"),
		Type:        "template",
	}
	if metadata.Version == "" {
		metadata.Version = "1.0.0"
	}

	if err := s.writeMetadata(id, metadata); err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Join(templatePath, "data"), 0o755); err != nil {
		return "", fmt.Errorf("failed to create template data directory: %w", err)
	}

	return id, nil
}

// UpdateTemplate updates the metadata of an existing template.
func (s *TemplateService) UpdateTemplate(id, name, version, description, author string) error {
	metadata, ok := s.readMetadata(id)
	if !ok {
		return fmt.Errorf("template %s does not exist", id)
	}

	metadata.Name = name
	if version != "" {
		metadata.Version = version
	}
	metadata.Description = description
	metadata.Author = author

	return s.writeMetadata(id, metadata)
}

// DeleteTemplate removes a template and all of its files.
func (s *TemplateService) DeleteTemplate(id string) error {
	return os.RemoveAll(filepath.Join(s.templatesPath, id))
}

// OpenTemplateFolder reveals the template's data folder in the platform file explorer.
func (s *TemplateService) OpenTemplateFolder(id string) error {
	target := filepath.Join(s.templatesPath, id, "data")
	if _, err := os.Stat(target); os.IsNotExist(err) {
		// Fall back to the template root if the data folder is missing.
		target = filepath.Join(s.templatesPath, id)
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", target)
	case "darwin":
		cmd = exec.Command("open", target)
	default:
		cmd = exec.Command("xdg-open", target)
	}
	return cmd.Start()
}

// readMetadata reads and parses a template's metadata.json. Returns ok=false if missing/invalid.
func (s *TemplateService) readMetadata(id string) (TemplateMetadata, bool) {
	data, err := os.ReadFile(filepath.Join(s.templatesPath, id, "metadata.json"))
	if err != nil {
		return TemplateMetadata{}, false
	}
	var metadata TemplateMetadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		return TemplateMetadata{}, false
	}
	return metadata, true
}

// writeMetadata writes a template's metadata.json.
func (s *TemplateService) writeMetadata(id string, metadata TemplateMetadata) error {
	data, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal template metadata: %w", err)
	}
	return os.WriteFile(filepath.Join(s.templatesPath, id, "metadata.json"), data, 0o644)
}

// randStr returns a random lowercase alphanumeric string of length n.
func randStr(n int) string {
	const letters = "0123456789abcdefghijklmnopqrstuvwxyz"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.IntN(len(letters))]
	}
	return string(b)
}