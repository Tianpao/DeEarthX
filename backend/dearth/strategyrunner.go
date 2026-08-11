package dearth

import (
	"log/slog"

	"dex/backend/dearth/strategies"
	"dex/backend/dearth/types"
)

// RunFilterStrategies runs filter strategies in priority order to identify client-side mods.
// Priority: Dexpub (highest) -> Hash + Modrinth (parallel) -> CurseForge -> Mcmod -> Mixin (lowest)
func RunFilterStrategies(files []types.FileInfo, config types.FilterConfig) ([]string, error) {
	var clientMods []string
	gsDecided := make(map[string]bool)
	skipForMixin := make(map[string]bool)

	// Priority 1: Galaxy Square (Dexpub)
	if config.Dexpub {
		slog.Info("Running Galaxy Square (dexpub) filter")
		dexpub := strategies.NewDexpubFilter()

		dexpubMods, err := dexpub.Filter(files)
		if err != nil {
			slog.Error("Dexpub filter error", "error", err)
		} else {
			serverMods, _ := dexpub.GetServerMods(files)
			for _, mod := range dexpubMods {
				gsDecided[mod] = true
				skipForMixin[mod] = true
			}
			for _, mod := range serverMods {
				gsDecided[mod] = true
				skipForMixin[mod] = true
			}
			clientMods = append(clientMods, dexpubMods...)
		}
	}

	// Priority 2: Hash and Modrinth API (parallel, same tier)
	var hashMods, modrinthMods []string
	if config.Hashes || config.Modrinth {
		unprocessed := filterUndecided(files, gsDecided)

		hashCh := make(chan []string, 1)
		modrinthCh := make(chan []string, 1)

		if config.Hashes {
			go func() {
				slog.Info("Running Hash filter")
				mods, err := strategies.NewHashFilter().Filter(unprocessed)
				if err != nil {
					slog.Error("Hash filter error", "error", err)
					mods = nil
				}
				hashCh <- mods
			}()
		} else {
			hashCh <- nil
		}

		if config.Modrinth {
			go func() {
				slog.Info("Running Modrinth filter")
				mods, err := strategies.NewModrinthFilter().Filter(unprocessed)
				if err != nil {
					slog.Error("Modrinth filter error", "error", err)
					mods = nil
				}
				modrinthCh <- mods
			}()
		} else {
			modrinthCh <- nil
		}

		hashMods = <-hashCh
		modrinthMods = <-modrinthCh
	}

	// Merge Hash and Modrinth results (deduplicated)
	seen := make(map[string]bool)
	for _, mod := range hashMods {
		if !seen[mod] {
			seen[mod] = true
			skipForMixin[mod] = true
			clientMods = append(clientMods, mod)
		}
	}
	for _, mod := range modrinthMods {
		if !seen[mod] {
			seen[mod] = true
			skipForMixin[mod] = true
			clientMods = append(clientMods, mod)
		}
	}

	// Priorities 3 & 4 both resolve CurseForge fingerprints, so do it once and
	// share the result. This is the slow, timeout-prone call.
	var cfFingerprints map[uint32]strategies.FingerprintMatch
	if config.CurseForge || config.Mcmod {
		slog.Info("Resolving CurseForge fingerprints")
		cfFingerprints = strategies.ResolveFingerprints(allFingerprints(files))
	}

	// Priority 3: CurseForge fingerprints gameVersions
	if config.CurseForge {
		slog.Info("Running CurseForge filter")
		cf := strategies.NewCurseForgeFilter()
		cf.SetSharedFingerprints(cfFingerprints)
		curseMods, err := cf.Filter(filterUndecided(files, skipForMixin))
		if err != nil {
			slog.Error("CurseForge filter error", "error", err)
		} else {
			for _, mod := range curseMods {
				skipForMixin[mod] = true
			}
			clientMods = append(clientMods, curseMods...)
		}
	}

	// Priority 4: Mcmod API
	if config.Mcmod {
		slog.Info("Running Mcmod filter")
		mf := strategies.NewMcmodFilter()
		mf.SetSharedFingerprints(cfFingerprints)
		mcmodMods, err := mf.Filter(filterUndecided(files, skipForMixin))
		if err != nil {
			slog.Error("Mcmod filter error", "error", err)
		} else {
			for _, mod := range mcmodMods {
				skipForMixin[mod] = true
			}
			clientMods = append(clientMods, mcmodMods...)
		}
	}

	// Priority 5: Mixin (lowest)
	if config.Mixins {
		slog.Info("Running Mixin filter")
		mixinMods, err := strategies.NewMixinFilter().Filter(filterUndecided(files, skipForMixin))
		if err != nil {
			slog.Error("Mixin filter error", "error", err)
		} else {
			clientMods = append(clientMods, mixinMods...)
		}
	}

	return deduplicate(clientMods), nil
}

func allFingerprints(files []types.FileInfo) []uint32 {
	var fps []uint32
	for _, f := range files {
		if f.Murmur2 != 0 {
			fps = append(fps, f.Murmur2)
		}
	}
	return fps
}

func filterUndecided(files []types.FileInfo, decided map[string]bool) []types.FileInfo {
	var result []types.FileInfo
	for _, f := range files {
		if !decided[f.Filename] {
			result = append(result, f)
		}
	}
	return result
}

func deduplicate(items []string) []string {
	seen := make(map[string]bool)
	var result []string
	for _, item := range items {
		if !seen[item] {
			seen[item] = true
			result = append(result, item)
		}
	}
	return result
}
