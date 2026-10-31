package download

import (
	"dex/backend/platform"
	"dex/backend/utils"
	"os"
	"path/filepath"
	"testing"
)

func TestInstallLoaderAppliesSelectedTemplate(t *testing.T) {
	root := t.TempDir()
	utils.SetAppDir(root)
	t.Cleanup(func() { utils.SetAppDir("") })
	source := filepath.Join(root, "templates", "selected", "data")
	if err := os.MkdirAll(source, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(source, "selected.txt"), []byte("chosen"), 0644); err != nil {
		t.Fatal(err)
	}
	output := filepath.Join(root, "instance", "test")
	err := NewModpackService().installLoader(&platform.ModpackInfo{Loader: "forge", Minecraft: "invalid", LoaderVersion: "invalid"}, output, ModeServer, "selected")
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(output, "selected.txt"))
	if err != nil || string(data) != "chosen" {
		t.Fatalf("template was not applied: %q, %v", data, err)
	}
}

func TestRejectMissingTemplateBeforeStarting(t *testing.T) {
	root := t.TempDir()
	utils.SetAppDir(root)
	t.Cleanup(func() { utils.SetAppDir("") })
	if _, err := NewModpackService().ProcessModpack([]byte("not a zip"), "test.zip", ModeServer, "missing"); err == nil {
		t.Fatal("accepted missing template")
	}
	if _, err := os.Stat(filepath.Join(root, "instance")); !os.IsNotExist(err) {
		t.Fatalf("pipeline created instance before template validation: %v", err)
	}
}
