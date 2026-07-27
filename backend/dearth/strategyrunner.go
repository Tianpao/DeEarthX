package dearth

import (
	"fmt"

	"dex/backend/dearth/strategies"
	"dex/backend/dearth/types"
)

// RunFilterStrategies runs filter strategies in priority order to identify client-side mods.
// Priority: Dexpub (highest) -> Hash + Modrinth (parallel) -> Mcmod -> Mixin (lowest)
func RunFilterStrategies(files []types.FileInfo, config types.FilterConfig) ([]string, error) {
	var clientMods []string
	gsDecided := make(map[string]bool)
	skipForMixin := make(map[string]bool)

	// Priority 1: Galaxy Square (Dexpub)
	if config.Dexpub {
		fmt.Println("Running Galaxy Square (dexpub) filter...")
		dexpub := strategies.NewDexpubFilter()

		dexpubMods, err := dexpub.Filter(files)
		if err != nil {
			fmt.Printf("Dexpub filter error: %v\n", err)
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
				fmt.Println("Running Hash filter...")
				mods, err := strategies.NewHashFilter().Filter(unprocessed)
				if err != nil {
					fmt.Printf("Hash filter error: %v\n", err)
					mods = nil
				}
				hashCh <- mods
			}()
		} else {
			hashCh <- nil
		}

		if config.Modrinth {
			go func() {
				fmt.Println("Running Modrinth filter...")
				mods, err := strategies.NewModrinthFilter().Filter(unprocessed)
				if err != nil {
					fmt.Printf("Modrinth filter error: %v\n", err)
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

	// Priority 3: Mcmod API
	if config.Mcmod {
		fmt.Println("Running Mcmod filter...")
		mcmodMods, err := strategies.NewMcmodFilter().Filter(filterUndecided(files, skipForMixin))
		if err != nil {
			fmt.Printf("Mcmod filter error: %v\n", err)
		} else {
			for _, mod := range mcmodMods {
				skipForMixin[mod] = true
			}
			clientMods = append(clientMods, mcmodMods...)
		}
	}

	// Priority 4: Mixin (lowest)
	if config.Mixins {
		fmt.Println("Running Mixin filter...")
		mixinMods, err := strategies.NewMixinFilter().Filter(filterUndecided(files, skipForMixin))
		if err != nil {
			fmt.Printf("Mixin filter error: %v\n", err)
		} else {
			clientMods = append(clientMods, mixinMods...)
		}
	}

	return deduplicate(clientMods), nil
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
