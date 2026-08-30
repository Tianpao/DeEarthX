package template

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"deearthx/core/util"
)

// TemplateService manages server templates on disk
type TemplateService struct {
	templatesPath string
}

// NewTemplateService creates a TemplateService.
// If templatesPath is empty, uses <appDir>/templates.
func NewTemplateService(templatesPath string) *TemplateService {
	if templatesPath == "" {
		templatesPath = filepath.Join(util.GetAppDir(), "templates")
	}
	ts := &TemplateService{templatesPath: templatesPath}
	_ = os.MkdirAll(ts.templatesPath, 0755)
	_ = ts.ensureDefaultTemplate()
	return ts
}

func (ts *TemplateService) ensureDefaultTemplate() error {
	exampleID := "example"
	metadataPath := filepath.Join(ts.templatesPath, exampleID, "metadata.json")
	if util.FileExists(metadataPath) {
		return nil
	}

	templatePath := filepath.Join(ts.templatesPath, exampleID)
	if err := os.MkdirAll(filepath.Join(templatePath, "data"), 0755); err != nil {
		return err
	}

	meta := TemplateMetadata{
		ID:          exampleID,
		Name:        "example",
		Version:     "1.0.0",
		Description: "Example template for DeEarthX",
		Author:      "DeEarthX",
		Created:     time.Now().Format("2006-01-02"),
		Type:        "template",
	}
	if err := ts.writeMetadata(exampleID, meta); err != nil {
		return err
	}

	readmePath := filepath.Join(templatePath, "data", "README.txt")
	return util.WriteFile(readmePath, "This is an example template for DeEarthX.\nPlace your server files in this data folder.")
}

// List returns all templates
func (ts *TemplateService) List() ([]TemplateMetadata, error) {
	entries, err := os.ReadDir(ts.templatesPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []TemplateMetadata{}, nil
		}
		return nil, err
	}

	result := make([]TemplateMetadata, 0)
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		meta, err := ts.readMetadata(entry.Name())
		if err != nil {
			util.Logger.Warn(fmt.Sprintf("Failed to read template %s: %v", entry.Name(), err))
			continue
		}
		meta.ID = entry.Name()
		result = append(result, *meta)
	}
	return result, nil
}

// Create creates a new template and returns its metadata
func (ts *TemplateService) Create(name, version, description, author string) (*TemplateMetadata, error) {
	if name == "" {
		return nil, fmt.Errorf("template name is required")
	}
	if version == "" {
		version = "1.0.0"
	}

	id := fmt.Sprintf("template-%d-%s", time.Now().UnixMilli(), randomSuffix(7))
	meta := TemplateMetadata{
		ID:          id,
		Name:        name,
		Version:     version,
		Description: description,
		Author:      author,
		Created:     time.Now().Format("2006-01-02"),
		Type:        "template",
	}

	templatePath := filepath.Join(ts.templatesPath, id)
	if err := os.MkdirAll(filepath.Join(templatePath, "data"), 0755); err != nil {
		return nil, err
	}
	if err := ts.writeMetadata(id, meta); err != nil {
		_ = os.RemoveAll(templatePath)
		return nil, err
	}
	return &meta, nil
}

// Update updates a template's metadata
func (ts *TemplateService) Update(id string, metadata TemplateMetadata) error {
	existing, err := ts.readMetadata(id)
	if err != nil {
		return fmt.Errorf("template %s does not exist", id)
	}

	if metadata.Name != "" {
		existing.Name = metadata.Name
	}
	if metadata.Version != "" {
		existing.Version = metadata.Version
	}
	existing.Description = metadata.Description
	existing.Author = metadata.Author
	if metadata.Type != "" {
		existing.Type = metadata.Type
	}
	existing.ID = id

	return ts.writeMetadata(id, *existing)
}

// Delete deletes a template
func (ts *TemplateService) Delete(id string) error {
	templatePath := filepath.Join(ts.templatesPath, id)
	if !util.FileExists(templatePath) {
		return fmt.Errorf("template %s does not exist", id)
	}
	return os.RemoveAll(templatePath)
}

// OpenFolder opens a template folder in the system file manager
func (ts *TemplateService) OpenFolder(id string) error {
	templatePath := filepath.Join(ts.templatesPath, id)
	if !util.FileExists(templatePath) {
		return fmt.Errorf("template %s does not exist", id)
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", templatePath)
	case "darwin":
		cmd = exec.Command("open", templatePath)
	default:
		cmd = exec.Command("xdg-open", templatePath)
	}
	return cmd.Start()
}

func (ts *TemplateService) readMetadata(id string) (*TemplateMetadata, error) {
	metadataPath := filepath.Join(ts.templatesPath, id, "metadata.json")
	data, err := os.ReadFile(metadataPath)
	if err != nil {
		return nil, err
	}
	var meta TemplateMetadata
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, err
	}
	meta.ID = id
	return &meta, nil
}

func (ts *TemplateService) writeMetadata(id string, meta TemplateMetadata) error {
	meta.ID = id
	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	metadataPath := filepath.Join(ts.templatesPath, id, "metadata.json")
	return os.WriteFile(metadataPath, data, 0644)
}

func randomSuffix(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
