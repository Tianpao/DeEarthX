package dearth

import (
	"log/slog"

	"dex/backend/dearth/strategies"
	"dex/backend/dearth/types"
)

// RunFilterStrategies runs filter strategies in priority order to identify client-side mods.
// Priority: Dexpub (highest) -> Modrinth (Hash + embedded) -> CurseForge -> Mcmod -> Mixin (lowest)
//
// Consensus: CurseForge's "client-only" verdict is only trusted when corroborated
// by Modrinth and Mcmod. If both corroborators have no data on a mod, CurseForge's
// verdict stands on its own; otherwise any corroborator reporting the mod as
// dual/server-capable vetoes CurseForge's client flag.
func RunFilterStrategies(files []types.FileInfo, config types.FilterConfig) ([]string, error) {
	var clientMods []string
	gsDecided := make(map[string]bool)
	skipForMixin := make(map[string]bool)

	// Priority 1: Galaxy Square (Dexpub) — authoritative, decides immediately.
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

	// Priority 2: Modrinth verdicts (Hash by SHA1 + embedded project IDs, parallel).
	var modrinthVerdicts map[string]types.SideVerdict
	if config.Hashes || config.Modrinth {
		unprocessed := filterUndecided(files, gsDecided)

		hashCh := make(chan map[string]types.SideVerdict, 1)
		modrinthCh := make(chan map[string]types.SideVerdict, 1)

		if config.Hashes {
			go func() {
				slog.Info("Running Hash filter")
				hashCh <- strategies.NewHashFilter().Verdicts(unprocessed)
			}()
		} else {
			hashCh <- nil
		}

		if config.Modrinth {
			go func() {
				slog.Info("Running Modrinth filter")
				modrinthCh <- strategies.NewModrinthFilter().Verdicts(unprocessed)
			}()
		} else {
			modrinthCh <- nil
		}

		modrinthVerdicts = mergeVerdicts(<-hashCh, <-modrinthCh)
		for filename, v := range modrinthVerdicts {
			if v == types.VerdictClient {
				skipForMixin[filename] = true
				clientMods = append(clientMods, filename)
			}
		}
	}

	// Priorities 3 & 4 both resolve CurseForge fingerprints, so do it once and
	// share the result. This is the slow, timeout-prone call.
	var cfFingerprints map[uint32]strategies.FingerprintMatch
	if config.CurseForge || config.Mcmod {
		slog.Info("Resolving CurseForge fingerprints")
		cfFingerprints = strategies.ResolveFingerprints(allFingerprints(files))
	}

	// Mcmod verdicts — used both for its own client flags and to corroborate
	// CurseForge, so compute them before applying the CurseForge consensus.
	var mcmodVerdicts map[string]types.SideVerdict
	if config.Mcmod {
		slog.Info("Running Mcmod filter")
		mf := strategies.NewMcmodFilter()
		mf.SetSharedFingerprints(cfFingerprints)
		mcmodVerdicts = mf.Verdicts(filterUndecided(files, skipForMixin))
		for filename, v := range mcmodVerdicts {
			if v == types.VerdictClient {
				skipForMixin[filename] = true
				clientMods = append(clientMods, filename)
			}
		}
	}

	// Priority 3: CurseForge fingerprints gameVersions, vetted by consensus.
	if config.CurseForge {
		slog.Info("Running CurseForge filter")
		cf := strategies.NewCurseForgeFilter()
		cf.SetSharedFingerprints(cfFingerprints)
		cfVerdicts := cf.Verdicts(filterUndecided(files, skipForMixin))
		for filename, v := range cfVerdicts {
			if v != types.VerdictClient {
				continue
			}
			if consensusAllows(filename, modrinthVerdicts, mcmodVerdicts) {
				skipForMixin[filename] = true
				clientMods = append(clientMods, filename)
			}
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

// mergerVerdicts unions several verdict maps into one. A VerdictServer in any
// source wins (a corroborator explicitly saying "dual/server-capable" is the
// strongest veto signal); otherwise a VerdictClient is kept.
func mergeVerdicts(maps ...map[string]types.SideVerdict) map[string]types.SideVerdict {
	merged := make(map[string]types.SideVerdict)
	for _, m := range maps {
		for f, v := range m {
			if v == types.VerdictServer {
				merged[f] = types.VerdictServer
			} else if v == types.VerdictClient && merged[f] != types.VerdictServer {
				merged[f] = types.VerdictClient
			}
		}
	}
	return merged
}

// consensusAllows reports whether CurseForge's client-only verdict for a mod
// survives corroboration by Modrinth (modrinth) and Mcmod (mcmod).
//
// Rule: if both corroborators have no data, trust CurseForge alone. Otherwise
// the verdict is allowed only if no corroborator reports the mod as
// dual/server-capable and at least one corroborator agrees it is client-only.
func consensusAllows(filename string, modrinth, mcmod map[string]types.SideVerdict) bool {
	mv := modrinth[filename]
	cv := mcmod[filename]

	if mv == types.VerdictUnknown && cv == types.VerdictUnknown {
		return true // both silent -> trust CurseForge
	}
	if mv == types.VerdictServer || cv == types.VerdictServer {
		return false // a corroborator says it's dual/server-capable -> veto
	}
	return mv == types.VerdictClient || cv == types.VerdictClient
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
