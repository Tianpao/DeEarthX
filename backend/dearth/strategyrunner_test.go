package dearth

import (
	"testing"

	"dex/backend/dearth/types"
)

func TestConsensusAllows(t *testing.T) {
	// Modrinth says dual, Mcmod says dual -> CurseForge vetoed (the geckolib case).
	assertConsensus(t, "geckolib", map[string]types.SideVerdict{"geckolib": types.VerdictServer},
		map[string]types.SideVerdict{"geckolib": types.VerdictServer}, false)

	// Both corroborators silent -> trust CurseForge.
	assertConsensus(t, "a", nil, nil, true)

	// Both corroborators say client -> agree, keep.
	assertConsensus(t, "oculus",
		map[string]types.SideVerdict{"oculus": types.VerdictClient},
		map[string]types.SideVerdict{"oculus": types.VerdictClient}, true)

	// One corroborator says client, other silent -> keep.
	assertConsensus(t, "b",
		map[string]types.SideVerdict{"b": types.VerdictClient}, nil, true)

	// One corroborator says dual, other silent -> veto.
	assertConsensus(t, "c",
		map[string]types.SideVerdict{"c": types.VerdictServer}, nil, false)

	// One says client, other says dual -> veto.
	assertConsensus(t, "d",
		map[string]types.SideVerdict{"d": types.VerdictClient},
		map[string]types.SideVerdict{"d": types.VerdictServer}, false)
}

func assertConsensus(t *testing.T, filename string, modrinth, mcmod map[string]types.SideVerdict, want bool) {
	t.Helper()
	if got := consensusAllows(filename, modrinth, mcmod); got != want {
		t.Errorf("consensusAllows(%q) = %v, want %v", filename, got, want)
	}
}

func TestMergeVerdicts(t *testing.T) {
	// Server in any source wins over Client.
	got := mergeVerdicts(
		map[string]types.SideVerdict{"a": types.VerdictClient, "b": types.VerdictClient},
		map[string]types.SideVerdict{"a": types.VerdictServer, "c": types.VerdictClient},
	)
	if got["a"] != types.VerdictServer {
		t.Errorf("a = %v, want Server", got["a"])
	}
	if got["b"] != types.VerdictClient {
		t.Errorf("b = %v, want Client", got["b"])
	}
	if got["c"] != types.VerdictClient {
		t.Errorf("c = %v, want Client", got["c"])
	}
}