package strategies

import (
	"encoding/json"
	"strings"

	"dex/backend/dearth/types"
)

// maxMixinClassesPerJar caps how many mixin classes are bytecode-parsed per jar,
// guarding against pathological mods and keeping the scan cheap.
const maxMixinClassesPerJar = 128

// MixinFilter analyzes mixin configuration and mixin class bytecode to identify
// client-only mods. No network calls, pure static analysis.
type MixinFilter struct{}

func NewMixinFilter() *MixinFilter { return &MixinFilter{} }

func (mf *MixinFilter) Name() string { return "MixinFilter" }

func (mf *MixinFilter) Filter(files []types.FileInfo) ([]string, error) {
	var clientMods []string

	for _, file := range files {
		if strings.Contains(strings.ToLower(file.Filename), "lib") {
			continue
		}
		if isClientOnlyByMixin(file.Mixins) {
			clientMods = append(clientMods, file.Filename)
		}
	}

	return clientMods, nil
}

// mixinConfigWanted is the subset of a mixin config JSON we read for cheap-tier
// decisions (before touching any bytecode).
type mixinConfigWanted struct {
	Environment string `json:"environment"`
	Plugin      string `json:"plugin"`
	Required    *bool  `json:"required"`
}

// isClientOnlyByMixin reports whether the mixin evidence marks a jar as a
// client-only mod: it has client mixins whose bytecode (or config) proves they
// touch client code, and no clean server/common mixin that would make it dual-side.
// Safety exemptions mirror Arclight: plugin-filtered, optional, and @Pseudo
// mixins are not treated as evidence.
func isClientOnlyByMixin(mixins []types.MixinFile) bool {
	clientEvidence := false
	serverSafe := false
	parsed := make(map[string]*mixinClassInfo)
	budget := maxMixinClassesPerJar

	for _, mixin := range mixins {
		var cfg mixinConfigWanted
		if err := json.Unmarshal([]byte(mixin.Data), &cfg); err != nil {
			continue
		}
		// IMixinConfigPlugin can filter mixins at runtime by side; static analysis
		// cannot tell whether the mixin will apply, so skip the whole config.
		if cfg.Plugin != "" {
			continue
		}
		// required=false: a failed apply is only a warning, not a crash.
		if cfg.Required != nil && !*cfg.Required {
			continue
		}
		// Config declares itself client-only: strong signal, no bytecode needed.
		if strings.EqualFold(cfg.Environment, "CLIENT") {
			clientEvidence = true
			continue
		}

		for _, cls := range mixin.Classes {
			info := parsed[cls.Name]
			if info == nil {
				if budget <= 0 {
					break
				}
				budget--
				info = parseMixinClass(cls.Bytes)
				parsed[cls.Name] = info
			}
			if info == nil {
				continue // unparseable -> treat as no evidence
			}
			// @Pseudo mixins target classes that may not exist; conservative skip.
			if info.pseudo {
				continue
			}
			if info.referencesClient || info.classEnvClient {
				// Bytecode proves this mixin touches client code (or is declared client-only).
				clientEvidence = true
			} else {
				// A clean common/server mixin -> the mod is dual-side or core; keep it.
				serverSafe = true
			}
		}
	}

	return clientEvidence && !serverSafe
}