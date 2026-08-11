package strategies

import (
	"log/slog"

	"dex/backend/dearth/types"
)

// CurseForgeFilter checks mods by reading the gameVersions of the latest file
// from CurseForge's fingerprints API. A mod whose latest file is marked Client
// but not Server is considered a client-only mod.
type CurseForgeFilter struct {
	// fingerprints optionally holds a fingerprint map resolved once by the runner
	// and shared with the Mcmod filter, so the slow API is hit only once.
	fingerprints map[uint32]FingerprintMatch
}

func NewCurseForgeFilter() *CurseForgeFilter {
	return &CurseForgeFilter{}
}

func (cf *CurseForgeFilter) Name() string { return "CurseForgeFilter" }

// SetSharedFingerprints supplies a pre-resolved fingerprint map so the filter
// skips the network call. The map must cover a superset of the files passed to Filter.
func (cf *CurseForgeFilter) SetSharedFingerprints(m map[uint32]FingerprintMatch) {
	cf.fingerprints = m
}

func (cf *CurseForgeFilter) Filter(files []types.FileInfo) ([]string, error) {
	fingerprintMap := make(map[uint32]string)
	var fingerprints []uint32
	for _, file := range files {
		if file.Murmur2 != 0 {
			fingerprints = append(fingerprints, file.Murmur2)
			fingerprintMap[file.Murmur2] = file.Filename
		}
	}

	if len(fingerprints) == 0 {
		return nil, nil
	}

	matches := cf.fingerprints
	if matches == nil {
		slog.Info("CurseForgeFilter: resolving fingerprints")
		matches = ResolveFingerprints(fingerprints)
	}

	var clientMods []string
	for fp, match := range matches {
		if hasClientOnly(match.GameVersions) {
			if filename, ok := fingerprintMap[fp]; ok {
				clientMods = append(clientMods, filename)
			}
		}
	}

	return clientMods, nil
}

// hasClientOnly reports whether the gameVersions list marks a mod as client-only,
// i.e. it includes "Client" but not "Server".
func hasClientOnly(gameVersions []string) bool {
	var hasClient, hasServer bool
	for _, v := range gameVersions {
		if v == "Client" {
			hasClient = true
		} else if v == "Server" {
			hasServer = true
		}
	}
	return hasClient && !hasServer
}
