package strategies

import (
	"encoding/json"
	"strings"

	"deearthx/core/util"
)

// MixinFilter checks mods by analyzing mixin configurations
type MixinFilter struct{}

// NewMixinFilter creates a new MixinFilter
func NewMixinFilter() *MixinFilter {
	return &MixinFilter{}
}

// Name returns the strategy name
func (mf *MixinFilter) Name() string {
	return "MixinFilter"
}

// Filter returns client-side mods identified by mixin analysis
func (mf *MixinFilter) Filter(files []FileInfo) ([]string, error) {
	clientMods := []string{}

	for _, file := range files {
		// Skip library files
		if strings.Contains(file.Filename, "lib") {
			continue
		}

		mixinResult := mf.analyzeMixins(file.Mixins)

		if mixinResult.IsClientOnly {
			clientMods = append(clientMods, file.Filename)
			util.Logger.Debug("Mixin config marked as client mod",
				"filename", file.Filename,
				"reason", mixinResult.Reason)
		}
	}

	util.Logger.Debug("Mixin check complete", "clientMods", len(clientMods))
	return clientMods, nil
}

type mixinAnalysisResult struct {
	IsClientOnly bool
	Reason       string
}

type mixinConfig struct {
	Required bool     `json:"required"`
	Package  string   `json:"package"`
	Mixins   []string `json:"mixins"`
	Client   []string `json:"client"`
	Server   []string `json:"server"`
}

func (mf *MixinFilter) analyzeMixins(mixins []MixinFile) mixinAnalysisResult {
	hasCommonMixin := false
	hasServerMixin := false
	hasClientMixin := false

	for _, mixin := range mixins {
		var config mixinConfig
		if err := json.Unmarshal([]byte(mixin.Data), &config); err != nil {
			util.Logger.Warn("Failed to parse mixin config: " + mixin.Name)
			continue
		}

		if len(config.Mixins) > 0 {
			hasCommonMixin = true
		}
		if len(config.Server) > 0 {
			hasServerMixin = true
		}
		if len(config.Client) > 0 {
			hasClientMixin = true
		}
	}

	// Logic:
	// Only client mixins (no common, no server) → client mod
	// Has server mixins → server compatible
	// Has common + client but no server → uncertain, let other strategies judge
	if hasClientMixin && !hasCommonMixin && !hasServerMixin {
		return mixinAnalysisResult{IsClientOnly: true, Reason: "only has client mixins"}
	}

	return mixinAnalysisResult{IsClientOnly: false, Reason: ""}
}