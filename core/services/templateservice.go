package services

import "deearthx/core/template"

// TemplateService handles template operations
type TemplateService struct {
	ts *template.TemplateService
}

// NewTemplateService creates a new TemplateService
func NewTemplateService() *TemplateService {
	return &TemplateService{
		ts: template.NewTemplateService(""),
	}
}

// List returns all templates
func (s *TemplateService) List() ([]template.TemplateMetadata, error) {
	return s.ts.List()
}

// Create creates a new template
func (s *TemplateService) Create(name, version, description, author string) (*template.TemplateMetadata, error) {
	return s.ts.Create(name, version, description, author)
}

// Update updates a template
func (s *TemplateService) Update(id string, metadata template.TemplateMetadata) error {
	return s.ts.Update(id, metadata)
}

// Delete deletes a template
func (s *TemplateService) Delete(id string) error {
	return s.ts.Delete(id)
}

// OpenFolder opens a template folder
func (s *TemplateService) OpenFolder(id string) error {
	return s.ts.OpenFolder(id)
}