package dearth

import (
	"archive/zip"
	"encoding/json"
	"io"
	"path/filepath"
	"regexp"
	"strings"

	"resty.dev/v3"
)

type Galaxy struct {
	client *resty.Client
}

func NewGalaxy() *Galaxy {
	return &Galaxy{
		client: resty.New().
			SetBaseURL("https://galaxy.tianpao.top/").
			SetHeader("User-Agent", "DeEarthX"),
	}
}

func (g *Galaxy) ExtractModIDs(paths []string) []string {
	seen := make(map[string]bool)
	var result []string

	for _, p := range paths {
		for _, id := range extractModIDs(p) {
			if !seen[id] {
				seen[id] = true
				result = append(result, id)
			}
		}
	}

	return result
}

func (g *Galaxy) SubmitModIDs(modType string, modIDs []string) error {
	if len(modIDs) == 0 {
		return nil
	}

	resp, err := g.client.R().
		SetBody(map[string]string{"modid": strings.Join(modIDs, ",")}).
		Post("mod/submit/" + modType)
	if err != nil || resp.StatusCode() >= 400 {
		return err
	}

	return nil
}

var modIDRe = regexp.MustCompile(`modId\s*=\s*"([^"]+)"`)

func extractModIDs(path string) []string {
	r, err := zip.OpenReader(path)
	if err != nil {
		return nil
	}
	defer r.Close()

	var ids []string
	for _, f := range r.File {
		name := filepath.Base(f.Name)

		// (Neo)Forge
		if name == "mods.toml" || name == "neoforge.mods.toml" {
			data, err := readFile(f)
			if err != nil {
				continue
			}
			if m := modIDRe.FindSubmatch(data); len(m) >= 2 {
				ids = append(ids, string(m[1]))
			}
			continue
		}

		// Fabric
		if name == "fabric.mod.json" {
			data, err := readFile(f)
			if err != nil {
				continue
			}
			var obj struct {
				ID string `json:"id"`
			}
			if json.Unmarshal(data, &obj) == nil && obj.ID != "" {
				ids = append(ids, obj.ID)
			}
		}
	}
	return ids
}

func readFile(f *zip.File) ([]byte, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(rc)
}
