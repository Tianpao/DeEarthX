package services

import "deearthx/core/java"

// JavaService handles Java operations
type JavaService struct{}

// NewJavaService creates a new JavaService
func NewJavaService() *JavaService {
	return &JavaService{}
}

// CheckJava checks Java availability
func (s *JavaService) CheckJava(path string) java.JavaCheckResult {
	return java.CheckJava(path)
}

// DetectJavaPaths detects installed Java paths
func (s *JavaService) DetectJavaPaths() []string {
	return java.DetectJavaPaths()
}