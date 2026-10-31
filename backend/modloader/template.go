package modloader

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// TemplateDataPath validates that the selected template is a direct child of templates.
func TemplateDataPath(id string) (string, error) {
	if id == "" || id == "0" {
		return "", nil
	}
	if id == "." || id == ".." || strings.ContainsAny(id, "/\\:") || filepath.Base(id) != id {
		return "", fmt.Errorf("invalid template ID: %q", id)
	}
	root := filepath.Join(GetAppDir(), "templates", id)
	for _, path := range []string{root, filepath.Join(root, "data")} {
		info, err := os.Lstat(path)
		if err != nil {
			return "", fmt.Errorf("template %s: %w", id, err)
		}
		if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			return "", fmt.Errorf("template %s must be a real directory", id)
		}
	}
	return filepath.Join(root, "data"), nil
}

func applyTemplate(id, destination string) error {
	source, err := TemplateDataPath(id)
	if err != nil {
		return err
	}
	if source == "" {
		return nil
	}
	// Validate the whole source before copying, rather than following links outside it.
	err = filepath.WalkDir(source, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("template symlinks are not supported: %s", path)
		}
		if !entry.IsDir() && !entry.Type().IsRegular() {
			return fmt.Errorf("unsupported template file: %s", path)
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("invalid template %s: %w", id, err)
	}
	return filepath.WalkDir(source, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		target := filepath.Join(destination, rel)
		info, err := entry.Info()
		if err != nil {
			return err
		}
		// Never follow pre-existing output symlinks while applying a template.
		if existing, statErr := os.Lstat(target); statErr == nil && existing.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("template output is a symlink: %s", target)
		} else if statErr != nil && !os.IsNotExist(statErr) {
			return statErr
		}
		if entry.IsDir() {
			return os.MkdirAll(target, info.Mode().Perm()|0700)
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if err = os.WriteFile(target, data, info.Mode().Perm()); err != nil {
			return err
		}
		return os.Chmod(target, info.Mode().Perm())
	})
}
