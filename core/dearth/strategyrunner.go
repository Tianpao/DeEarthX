package dearth

import (
	"deearthx/core/dearth/strategies"
	"deearthx/core/util"
)

// RunFilterStrategies executes filter strategies with priority
func RunFilterStrategies(files []FileInfo, config FilterConfig, progress ProgressCallback) ([]string, error) {
	// Convert dearth.FileInfo to strategies.FileInfo
	strategyFiles := convertToStrategyFiles(files)

	clientMods := []string{}

	// Galaxy Square decided files - higher strategies cannot override
	gsDecidedFiles := make(map[string]bool)
	// Files blocked from Mixin check
	skipMixinFiles := make(map[string]bool)

	// Priority 1: Galaxy Square (Dexpub) - highest authority
	if config.Dexpub {
		util.Logger.Info("Starting Galaxy Square (dexpub) check")
		dexpubFilter := strategies.NewDexpubFilter()
		dexpubMods, err := dexpubFilter.Filter(strategyFiles)
		if err != nil {
			util.Logger.Error("Dexpub check failed: " + err.Error())
		} else {
			for _, mod := range dexpubMods {
				gsDecidedFiles[mod] = true
				skipMixinFiles[mod] = true
			}
			clientMods = append(clientMods, dexpubMods...)
		}

		serverMods, err := dexpubFilter.GetServerMods(strategyFiles)
		if err == nil {
			for _, mod := range serverMods {
				gsDecidedFiles[mod] = true
				skipMixinFiles[mod] = true
			}
		}

		if progress != nil {
			progress(len(gsDecidedFiles), len(files), "Galaxy Square (dexpub) check")
		}
	}

	// Priority 2: Hash and Modrinth (parallel, same level)
	// Files decided by GS are not passed to these strategies

	// Filter files not decided by GS
	unprocessedFiles := []strategies.FileInfo{}
	for _, f := range strategyFiles {
		if !gsDecidedFiles[f.Filename] {
			unprocessedFiles = append(unprocessedFiles, f)
		}
	}

	var hashMods, modrinthMods []string

	if config.Hashes {
		util.Logger.Info("Starting Hash check")
		hashFilter := strategies.NewHashFilter()
		mods, err := hashFilter.Filter(unprocessedFiles)
		if err != nil {
			util.Logger.Error("Hash check failed: " + err.Error())
		} else {
			hashMods = mods
		}
	}

	if config.Modrinth {
		util.Logger.Info("Starting Modrinth API check")
		modrinthFilter := strategies.NewModrinthFilter()
		mods, err := modrinthFilter.Filter(unprocessedFiles)
		if err != nil {
			util.Logger.Error("Modrinth check failed: " + err.Error())
		} else {
			modrinthMods = mods
		}
	}

	// Merge Hash and Modrinth results
	for _, mod := range hashMods {
		skipMixinFiles[mod] = true
	}
	for _, mod := range modrinthMods {
		skipMixinFiles[mod] = true
	}

	// Deduplicate
	hashModrinthMods := make(map[string]bool)
	for _, mod := range hashMods {
		hashModrinthMods[mod] = true
	}
	for _, mod := range modrinthMods {
		hashModrinthMods[mod] = true
	}

	for mod := range hashModrinthMods {
		clientMods = append(clientMods, mod)
	}

	if progress != nil && (config.Hashes || config.Modrinth) {
		progress(len(gsDecidedFiles)+len(hashModrinthMods), len(files), "Hash/Modrinth API check")
	}

	// Priority 3: Mcmod API
	if config.Mcmod {
		util.Logger.Info("Starting Mcmod API check")
		mcmodFiles := []strategies.FileInfo{}
		for _, f := range strategyFiles {
			if !skipMixinFiles[f.Filename] {
				mcmodFiles = append(mcmodFiles, f)
			}
		}

		mcmodFilter := strategies.NewMcmodFilter()
		mods, err := mcmodFilter.Filter(mcmodFiles)
		if err != nil {
			util.Logger.Error("Mcmod check failed: " + err.Error())
		} else {
			for _, mod := range mods {
				skipMixinFiles[mod] = true
			}
			clientMods = append(clientMods, mods...)
		}

		if progress != nil {
			progress(len(skipMixinFiles), len(files), "Mcmod API check")
		}
	}

	// Priority 4: Mixin (lowest priority)
	// GS decided files and Hash/Modrinth detected client mods cannot be overridden by Mixin
	if config.Mixins {
		util.Logger.Info("Starting Mixin check")
		mixinFiles := []strategies.FileInfo{}
		for _, f := range strategyFiles {
			if !skipMixinFiles[f.Filename] {
				mixinFiles = append(mixinFiles, f)
			}
		}

		mixinFilter := strategies.NewMixinFilter()
		mods, err := mixinFilter.Filter(mixinFiles)
		if err != nil {
			util.Logger.Error("Mixin check failed: " + err.Error())
		} else {
			clientMods = append(clientMods, mods...)
		}

		if progress != nil {
			progress(len(skipMixinFiles)+len(mods), len(files), "Mixin check")
		}
	}

	// Deduplicate final result
	uniqueMods := make(map[string]bool)
	result := []string{}
	for _, mod := range clientMods {
		if !uniqueMods[mod] {
			uniqueMods[mod] = true
			result = append(result, mod)
		}
	}

	result = ExcludeRequiredDependencies(result, files)

	util.Logger.Info("Identified client-side mods", "count", len(result))
	return result, nil
}

// convertToStrategyFiles converts dearth.FileInfo slice to strategies.FileInfo slice
func convertToStrategyFiles(files []FileInfo) []strategies.FileInfo {
	result := make([]strategies.FileInfo, len(files))
	for i, f := range files {
		result[i] = strategies.FileInfo{
			Filename: f.Filename,
			Hash:     f.Hash,
			Murmur2:  f.Murmur2,
			Mixins:   convertMixins(f.Mixins),
			Infos:    convertInfos(f.Infos),
			FileData: f.FileData,
		}
	}
	return result
}

func convertMixins(mixins []MixinFile) []strategies.MixinFile {
	result := make([]strategies.MixinFile, len(mixins))
	for i, m := range mixins {
		result[i] = strategies.MixinFile{
			Name: m.Name,
			Data: m.Data,
		}
	}
	return result
}

func convertInfos(infos []InfoFile) []strategies.InfoFile {
	result := make([]strategies.InfoFile, len(infos))
	for i, info := range infos {
		result[i] = strategies.InfoFile{
			Name: info.Name,
			Data: info.Data,
		}
	}
	return result
}