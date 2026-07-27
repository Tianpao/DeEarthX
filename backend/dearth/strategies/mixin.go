package strategies

import (
	"encoding/json"
	"fmt"
	"strings"

	"dex/backend/dearth/types"
)

// MixinFilter analyzes mixin configuration to identify client-only mods. No API calls.
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

// isClientOnlyByMixin: has client mixins AND no common/server mixins -> client-only.
func isClientOnlyByMixin(mixins []types.MixinFile) bool {
	hasCommon := false
	hasServer := false
	hasClient := false

	for _, mixin := range mixins {
		var raw map[string]any
		if err := json.Unmarshal([]byte(mixin.Data), &raw); err != nil {
			fmt.Printf("Mixin filter: failed to parse %s: %v\n", mixin.Name, err)
			continue
		}
		if arr, ok := raw["mixins"].([]any); ok && len(arr) > 0 {
			hasCommon = true
		}
		if arr, ok := raw["server"].([]any); ok && len(arr) > 0 {
			hasServer = true
		}
		if arr, ok := raw["client"].([]any); ok && len(arr) > 0 {
			hasClient = true
		}
	}

	return hasClient && !hasCommon && !hasServer
}
