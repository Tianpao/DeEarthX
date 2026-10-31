package dearth

import (
	"archive/zip"
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"dex/backend/dearth/types"
)

// FileExtractor scans a directory for .jar files and extracts metadata.
type FileExtractor struct {
	modsPath string
}

func NewFileExtractor(modsPath string) *FileExtractor {
	if !filepath.IsAbs(modsPath) {
		abs, _ := filepath.Abs(modsPath)
		modsPath = abs
	}
	return &FileExtractor{modsPath: modsPath}
}

// ExtractFilesInfo scans all .jar files and extracts SHA1, MurmurHash2, mixin configs, and mod metadata.
func (fe *FileExtractor) ExtractFilesInfo() ([]types.FileInfo, error) {
	jarFiles, err := fe.getJarFiles()
	if err != nil {
		return nil, err
	}

	slog.Info("FileExtractor: found jar files", "count", len(jarFiles))

	files := make([]types.FileInfo, 0, len(jarFiles))
	for _, jarFilename := range jarFiles {
		fullPath := filepath.Join(fe.modsPath, jarFilename)

		fileData, err := os.ReadFile(fullPath)
		if err != nil {
			slog.Error("error reading file", "file", fullPath, "error", err)
			continue
		}

		h := sha1.Sum(fileData)
		files = append(files, types.FileInfo{
			Filename: fullPath,
			Hash:     hex.EncodeToString(h[:]),
			Murmur2:  MurmurHash2(fileData),
			Mixins:   extractMixins(fileData),
			Infos:    extractModInfo(fileData),
		})
	}

	return files, nil
}

func (fe *FileExtractor) getJarFiles() ([]string, error) {
	if err := os.MkdirAll(fe.modsPath, 0o755); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(fe.modsPath)
	if err != nil {
		return nil, err
	}
	var jars []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".jar") {
			jars = append(jars, e.Name())
		}
	}
	return jars, nil
}

// mixinConfig mirrors the fields of a SpongePowered mixin config JSON we care about.
type mixinConfig struct {
	Package     string   `json:"package"`
	Mixins      []string `json:"mixins"`
	Server      []string `json:"server"`
	Client      []string `json:"client"`
	Environment string   `json:"environment"`
	Plugin      string   `json:"plugin"`
	Required    *bool    `json:"required"`
	Refmap      string   `json:"refmap"`
}

// extractMixins extracts mixin configuration JSON files from a jar, along with
// the bytecode of every mixin class referenced by each config. Only the classes
// named in the config are read (bounded by maxMixinClasses), so the scan stays
// cheap even for large jars.
func extractMixins(fileData []byte) []types.MixinFile {
	var mixins []types.MixinFile
	r, err := zip.NewReader(bytes.NewReader(fileData), int64(len(fileData)))
	if err != nil {
		return mixins
	}

	// Index entries by name for O(1) class lookup.
	entryByName := make(map[string]*zip.File, len(r.File))
	for _, f := range r.File {
		entryByName[f.Name] = f
	}

	registrations := mixinRegistrations(entryByName)
	seen := make(map[string]bool)
	addConfig := func(name, environment string, registered bool) {
		if seen[name] {
			return
		}
		seen[name] = true
		mf := types.MixinFile{Name: name, Environment: environment, Registered: registered}
		entry := entryByName[name]
		if entry == nil || entry.FileInfo().IsDir() {
			mf.Incomplete = true
			mixins = append(mixins, mf)
			return
		}
		data, err := readZipEntry(entry)
		mf.Data = string(data)
		var cfg mixinConfig
		if err != nil || json.Unmarshal(data, &cfg) != nil {
			mf.Incomplete = true
		} else {
			mf.Refmap = readRefmap(cfg.Refmap, entryByName)
			mf.Classes, mf.Incomplete = resolveMixinClassesState(&cfg, entryByName)
		}
		mixins = append(mixins, mf)
	}
	// Registered configs need not follow any naming convention. Walk the ZIP
	// first for stable output, then retain missing registrations as incomplete.
	for _, f := range r.File {
		if env, ok := registrations[f.Name]; ok {
			addConfig(f.Name, env, true)
		}
	}
	var missing []string
	for name := range registrations {
		if !seen[name] {
			missing = append(missing, name)
		}
	}
	sort.Strings(missing)
	for _, name := range missing {
		addConfig(name, registrations[name], true)
	}
	for _, f := range r.File {
		name := strings.ToLower(f.Name)
		if (strings.HasPrefix(name, "mixins.") || strings.HasPrefix(name, "mixin.") ||
			strings.Contains(name, ".mixins.json") || strings.Contains(name, ".mixin.json")) &&
			strings.HasSuffix(name, ".json") && !f.FileInfo().IsDir() {
			addConfig(f.Name, "common", false)
		}
	}
	return mixins
}

// mixinRegistrations reads loader registrations without guessing from filenames.
// Unspecified, wildcard, or unknown environments are conservatively common.
func mixinRegistrations(entries map[string]*zip.File) map[string]string {
	registrations := make(map[string]string)
	add := func(name, environment string) {
		name = strings.TrimSpace(name)
		if name == "" {
			return
		}
		if environment != "client" && environment != "server" {
			environment = "common"
		}
		if previous, ok := registrations[name]; ok && previous != environment {
			environment = "common"
		}
		registrations[name] = environment
	}
	if f := entries["fabric.mod.json"]; f != nil {
		if data, err := readZipEntry(f); err == nil {
			var metadata struct {
				Mixins []json.RawMessage `json:"mixins"`
			}
			if json.Unmarshal(data, &metadata) == nil {
				for _, raw := range metadata.Mixins {
					var name string
					if json.Unmarshal(raw, &name) == nil {
						add(name, "common")
						continue
					}
					var registration struct {
						Config      string `json:"config"`
						Environment string `json:"environment"`
					}
					if json.Unmarshal(raw, &registration) == nil {
						add(registration.Config, registration.Environment)
					}
				}
			}
		}
	}
	if f := entries["META-INF/MANIFEST.MF"]; f != nil {
		if data, err := readZipEntry(f); err == nil {
			// Manifest continuation lines concatenate without introducing spaces.
			var logical []string
			for _, line := range strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n") {
				if strings.HasPrefix(line, " ") && len(logical) > 0 {
					logical[len(logical)-1] += line[1:]
				} else {
					logical = append(logical, line)
				}
			}
			for _, line := range logical {
				key, value, ok := strings.Cut(line, ":")
				if ok && strings.EqualFold(key, "MixinConfigs") {
					for _, name := range strings.Split(value, ",") {
						add(name, "common")
					}
				}
			}
		}
	}
	return registrations
}

// readRefmap reads the optional refmap JSON named by a mixin config's "refmap"
// field from the jar. Returns nil if absent — the mixin judgement then falls
// back to bytecode-only signals.
func readRefmap(refmapName string, entryByName map[string]*zip.File) []byte {
	if refmapName == "" {
		return nil
	}
	entry, ok := entryByName[refmapName]
	if !ok || entry.FileInfo().IsDir() {
		return nil
	}
	b, err := readZipEntry(entry)
	if err != nil {
		return nil
	}
	return b
}

// maxMixinClassesPerConfig caps how many mixin classes are read per config,
// guarding against pathological configs that point at a huge class set.
const maxMixinClassesPerConfig = 64

// resolveMixinClasses reads the bytecode of the mixin classes named in a config
// (mixins/server/client arrays, resolved against the config's package prefix).
func resolveMixinClasses(cfg *mixinConfig, entryByName map[string]*zip.File) []types.MixinClass {
	classes, _ := resolveMixinClassesState(cfg, entryByName)
	return classes
}

// resolveMixinClassesState preserves group membership and reports lost evidence.
func resolveMixinClassesState(cfg *mixinConfig, entryByName map[string]*zip.File) ([]types.MixinClass, bool) {
	prefix := ""
	if cfg.Package != "" {
		prefix = strings.ReplaceAll(cfg.Package, ".", "/") + "/"
	}
	var classes []types.MixinClass
	incomplete := false
	// Resolve all group assignments before applying the read limit: a duplicate
	// in a later group must still downgrade an already-read class to common.
	var names []string
	sides := make(map[string]string)
	for _, group := range []struct {
		side  string
		names []string
	}{
		{"common", cfg.Mixins}, {"server", cfg.Server}, {"client", cfg.Client},
	} {
		for _, cls := range group.names {
			if cls == "" {
				incomplete = true
				continue
			}
			internal := prefix + strings.ReplaceAll(cls, ".", "/") + ".class"
			if previous, ok := sides[internal]; ok {
				if previous != group.side {
					sides[internal] = "common"
				}
			} else {
				names = append(names, internal)
				sides[internal] = group.side
			}
		}
	}
	if len(names) > maxMixinClassesPerConfig {
		incomplete = true
		names = names[:maxMixinClassesPerConfig]
	}
	for _, internal := range names {
		entry := entryByName[internal]
		if entry == nil || entry.FileInfo().IsDir() {
			incomplete = true
			continue
		}
		b, err := readZipEntry(entry)
		if err != nil {
			incomplete = true
			continue
		}
		classes = append(classes, types.MixinClass{Name: internal, Side: sides[internal], Bytes: b})
	}
	return classes, incomplete
}

// extractModInfo extracts mod metadata files from a jar.
func extractModInfo(fileData []byte) []types.InfoFile {
	var infos []types.InfoFile
	r, err := zip.NewReader(bytes.NewReader(fileData), int64(len(fileData)))
	if err != nil {
		return infos
	}
	infoFiles := map[string]bool{
		"fabric.mod.json":     true,
		"mods.toml":           true,
		"neoforge.mods.toml":  true,
		"modrinth.index.json": true,
		"modrinth.json":       true,
		"quilt.mod.json":      true,
	}
	for _, f := range r.File {
		base := filepath.Base(f.Name)
		if infoFiles[base] && !f.FileInfo().IsDir() {
			data, err := readZipEntry(f)
			if err != nil {
				continue
			}
			infos = append(infos, types.InfoFile{Name: base, Data: string(data)})
		}
	}
	return infos
}

func readZipEntry(f *zip.File) ([]byte, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(rc)
}

// ExtractModIDsFromInfos extracts mod IDs from info files.
func ExtractModIDsFromInfos(infos []types.InfoFile) []string {
	var modIDs []string
	for _, info := range infos {
		switch info.Name {
		case "fabric.mod.json", "quilt.mod.json":
			var obj struct {
				ID string `json:"id"`
			}
			if json.Unmarshal([]byte(info.Data), &obj) == nil && obj.ID != "" {
				modIDs = append(modIDs, obj.ID)
			}
		case "mods.toml", "neoforge.mods.toml":
			for _, line := range strings.Split(info.Data, "\n") {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "modId") {
					if parts := strings.SplitN(line, "=", 2); len(parts) == 2 {
						id := strings.Trim(strings.TrimSpace(parts[1]), "\"'")
						if id != "" {
							modIDs = append(modIDs, id)
						}
					}
				}
			}
		case "modrinth.index.json", "modrinth.json":
			var obj struct {
				ProjectID string `json:"project_id"`
			}
			if json.Unmarshal([]byte(info.Data), &obj) == nil && obj.ProjectID != "" {
				modIDs = append(modIDs, obj.ProjectID)
			}
		}
	}
	return modIDs
}
