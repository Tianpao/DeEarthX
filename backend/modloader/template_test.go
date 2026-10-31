package modloader

import (
	"dex/backend/utils"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestCustomTemplateSetup(t *testing.T) {
	root := t.TempDir()
	utils.SetAppDir(root)
	t.Cleanup(func() { utils.SetAppDir("") })
	source := filepath.Join(root, "templates", "custom", "data")
	if err := os.MkdirAll(filepath.Join(source, "config", "empty"), 0755); err != nil {
		t.Fatal(err)
	}
	for name, content := range map[string]string{"run.sh": "#!/bin/sh\necho custom\n", "installer.log": "user-owned", "forge-test-installer.jar": "template jar"} {
		if err := os.WriteFile(filepath.Join(source, name), []byte(content), 0755); err != nil {
			t.Fatal(err)
		}
	}
	output := filepath.Join(root, "output")
	// Invalid versions prove custom templates never invoke a loader/network install.
	if err := MLSetup("forge", "invalid", "invalid", output, "custom"); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"run.sh", "installer.log", "forge-test-installer.jar", "config/empty"} {
		if _, err := os.Stat(filepath.Join(output, name)); err != nil {
			t.Fatal(err)
		}
	}
	if runtime.GOOS != "windows" {
		info, err := os.Stat(filepath.Join(output, "run.sh"))
		if err != nil {
			t.Fatal(err)
		}
		if info.Mode().Perm()&0111 == 0 {
			t.Fatal("script lost executable permission")
		}
	}
}

func TestTemplateValidation(t *testing.T) {
	utils.SetAppDir(t.TempDir())
	t.Cleanup(func() { utils.SetAppDir("") })
	for _, id := range []string{"..", ".", "../escape", "a/b", "a\\b", "C:escape", "missing"} {
		if _, err := TemplateDataPath(id); err == nil {
			t.Errorf("accepted %q", id)
		}
	}
	for _, id := range []string{"", "0"} {
		if _, err := TemplateDataPath(id); err != nil {
			t.Fatal(err)
		}
	}
}

func TestTemplateRejectsSymlink(t *testing.T) {
	root := t.TempDir()
	utils.SetAppDir(root)
	t.Cleanup(func() { utils.SetAppDir("") })
	source := filepath.Join(root, "templates", "linked", "data")
	if err := os.MkdirAll(source, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(t.TempDir(), filepath.Join(source, "escape")); err != nil {
		t.Skipf("symlink unavailable: %v", err)
	}
	if err := applyTemplate("linked", filepath.Join(root, "output")); err == nil {
		t.Fatal("accepted linked source")
	}
}
