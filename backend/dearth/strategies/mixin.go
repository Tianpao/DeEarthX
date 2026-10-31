package strategies

import (
	"dex/backend/dearth/types"
	"encoding/json"
	"log/slog"
	"strings"
)

const maxMixinClassesPerJar = 128

type MixinFilter struct{}

func NewMixinFilter() *MixinFilter   { return &MixinFilter{} }
func (mf *MixinFilter) Name() string { return "MixinFilter" }

// Mixin evidence describes individual injection risks, not the side of the entire mod.
// Only an explicit loader-level client declaration permits automatic removal here.
func (mf *MixinFilter) Filter(files []types.FileInfo) ([]string, error) {
	var clientMods []string
	for _, file := range files {
		if explicitlyClientMod(file.Infos) {
			clientMods = append(clientMods, file.Filename)
			continue
		}
		report := AnalyzeMixins(file.Mixins)
		if report.Risky > 0 {
			slog.Warn("Mixin client dependency: mod retained pending side confirmation", "file", file.Filename, "reasons", report.Reasons)
		}
	}
	return clientMods, nil
}

// MixinAnalysis never equates 'no risk found' with 'server compatible'.
type MixinAnalysis struct {
	Isolated int
	Risky    int
	Unknown  int
	Reasons  []string
}

func explicitlyClientMod(infos []types.InfoFile) bool {
	found := false
	for _, info := range infos {
		name := strings.ToLower(strings.ReplaceAll(info.Name, "\\", "/"))
		// A multi-loader jar is deliberately kept: Fabric's declaration says nothing
		// about its Forge/NeoForge entrypoints.
		if strings.HasSuffix(name, "mods.toml") || strings.HasSuffix(name, "mcmod.info") || name == "quilt.mod.json" {
			return false
		}
		if name != "fabric.mod.json" {
			continue
		}
		var metadata struct {
			Environment string `json:"environment"`
		}
		if json.Unmarshal([]byte(info.Data), &metadata) != nil || metadata.Environment != "client" {
			return false
		}
		found = true
	}
	return found
}

type mixinConfigWanted struct {
	Plugin   string `json:"plugin"`
	Required *bool  `json:"required"`
}

func AnalyzeMixins(mixins []types.MixinFile) MixinAnalysis {
	report := MixinAnalysis{}
	budget := maxMixinClassesPerJar
	for _, mixin := range mixins {
		var cfg mixinConfigWanted
		if json.Unmarshal([]byte(mixin.Data), &cfg) != nil {
			report.Unknown++
			continue
		}
		if mixin.Incomplete || !mixin.Registered || cfg.Plugin != "" || (cfg.Required != nil && !*cfg.Required) {
			report.Unknown++
			report.Reasons = append(report.Reasons, mixin.Name+": dynamic, unregistered, optional or incomplete configuration")
			continue
		}
		if len(mixin.Classes) == 0 {
			report.Unknown++
			continue
		}
		refmapClient := refmapClientSet(mixin.Refmap)
		for _, cls := range mixin.Classes {
			if budget <= 0 {
				report.Unknown++
				continue
			}
			budget--
			info := parseMixinClass(cls.Bytes)
			if info == nil || info.pseudo {
				report.Unknown++
				continue
			}
			// Loader registration and client arrays are actual side guards. The config's
			// arbitrary environment field and class annotations alone are not proof.
			if mixin.Environment == "client" || cls.Side == "client" {
				report.Isolated++
				continue
			}
			if cls.Side != "common" && cls.Side != "server" {
				report.Unknown++
				continue
			}
			evidence := info.referencesClient || refmapClient[trimClassSuffix(cls.Name)]
			for _, target := range info.targets {
				if isClientOwner(target) {
					evidence = true
				}
			}
			if info.classEnvClient || info.memberEnvClient {
				report.Unknown++
				continue
			}
			if evidence {
				report.Risky++
				report.Reasons = append(report.Reasons, mixin.Name+": "+cls.Name+" references a client target outside a client-only registration")
			} else {
				report.Unknown++
			}
		}
	}
	return report
}

// refmapClientSet parses a mixin refmap and returns the set of mixin class
// internal names whose mapped targets include a client-only Minecraft class.
// Returns nil on an absent/empty refmap or a parse failure.
func refmapClientSet(refmap []byte) map[string]bool {
	if len(refmap) == 0 {
		return nil
	}
	var rm struct {
		Mappings map[string]map[string]string            `json:"mappings"`
		Data     map[string]map[string]map[string]string `json:"data"`
	}
	if err := json.Unmarshal(refmap, &rm); err != nil {
		return nil
	}
	client := make(map[string]bool)
	mappings := []map[string]map[string]string{rm.Mappings}
	for _, environment := range rm.Data {
		mappings = append(mappings, environment)
	}
	for _, mapping := range mappings {
		for mixinCls, targets := range mapping {
			for _, desc := range targets {
				owner := refmapOwner(desc)
				if owner != "" && isClientOwner(owner) {
					if client == nil {
						client = make(map[string]bool)
					}
					client[strings.ReplaceAll(trimClassSuffix(mixinCls), ".", "/")] = true
					break
				}
			}
		}
	}
	if len(client) == 0 {
		return nil
	}
	return client
}

// refmapOwner extracts the target class owner from a refmap descriptor like
// "Lnet/minecraft/client/Minecraft;m_91277_()V". Returns "" on non-class refs.
func refmapOwner(desc string) string {
	if len(desc) < 2 || desc[0] != 'L' {
		return ""
	}
	owner := desc[1:]
	if semi := strings.IndexByte(owner, ';'); semi >= 0 {
		owner = owner[:semi]
	}
	return owner
}

// trimClassSuffix strips the ".class" suffix from a mixin class internal name so
// it can be matched against a refmap key (which omits the suffix).
func trimClassSuffix(name string) string {
	return strings.TrimSuffix(name, ".class")
}
