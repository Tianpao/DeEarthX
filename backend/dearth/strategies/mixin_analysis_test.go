package strategies

import (
	"dex/backend/dearth/types"
	"testing"
)

func TestAnalyzeMixinsEnvironment(t *testing.T) {
	tests := []struct {
		name, side, env          string
		registered, incomplete   bool
		risky, isolated, unknown int
	}{
		{"26.1 named no refmap common risk", "common", "common", true, false, 1, 0, 0},
		{"client array safely isolated", "client", "common", true, false, 0, 1, 0},
		{"client registration safely isolated", "common", "client", true, false, 0, 1, 0},
		{"server array client reference risk", "server", "common", true, false, 1, 0, 0},
		{"unregistered resource not executed", "common", "common", false, false, 0, 0, 1},
		{"incomplete extraction is unknown", "common", "common", true, true, 0, 0, 1},
		{"unknown side is not inferred", "", "common", true, false, 0, 0, 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			report := AnalyzeMixins([]types.MixinFile{{Name: "test.json", Data: "{}", Registered: tt.registered, Incomplete: tt.incomplete, Environment: tt.env, Classes: []types.MixinClass{{Name: "Client.class", Bytes: clientRefClass(), Side: tt.side}}}})
			if report.Risky != tt.risky || report.Isolated != tt.isolated || report.Unknown != tt.unknown {
				t.Fatalf("unexpected report: %+v", report)
			}
		})
	}
}

func TestMixinDoesNotEquateRiskWithWholeModSide(t *testing.T) {
	files := []types.FileInfo{
		{Filename: "both.jar", Mixins: []types.MixinFile{{Data: "{}", Registered: true, Classes: []types.MixinClass{{Name: "Client.class", Side: "common", Bytes: clientRefClass()}}}}},
		{Filename: "/libs/client-library.jar", Infos: []types.InfoFile{{Name: "fabric.mod.json", Data: `{"environment":"client"}`}}},
		{Filename: "dual.jar", Infos: []types.InfoFile{{Name: "fabric.mod.json", Data: `{"environment":"*"}`}}},
		{Filename: "multi.jar", Infos: []types.InfoFile{{Name: "fabric.mod.json", Data: `{"environment":"client"}`}, {Name: "META-INF/neoforge.mods.toml", Data: ""}}},
	}
	mods, err := NewMixinFilter().Filter(files)
	if err != nil || len(mods) != 1 || mods[0] != files[1].Filename {
		t.Fatalf("unexpected removals %v, %v", mods, err)
	}
}

func TestNamedAnnotationTargetsWithoutRefmap(t *testing.T) {
	data := targetFixture()
	data[6], data[7] = 0, 69
	report := AnalyzeMixins([]types.MixinFile{{Name: "named.json", Data: "{}", Registered: true, Environment: "common", Classes: []types.MixinClass{{Name: "Target.class", Side: "common", Bytes: data}}}})
	if report.Risky != 1 {
		t.Fatalf("named @Mixin targets without refmap missed: %+v", report)
	}
	// Annotation remapping does not change the side of these same targets.
	if mods, err := NewMixinFilter().Filter([]types.FileInfo{{Filename: "named.jar", Mixins: []types.MixinFile{{Name: "named.json", Data: "{}", Registered: true, Classes: []types.MixinClass{{Name: "Target.class", Side: "common", Bytes: data}}}}}}); err != nil || len(mods) != 0 {
		t.Fatalf("risk auto-removed whole mod: %v %v", mods, err)
	}
}

func TestAnalysisBudgetIsUnknown(t *testing.T) {
	var classes []types.MixinClass
	for i := 0; i < maxMixinClassesPerJar+1; i++ {
		classes = append(classes, types.MixinClass{Name: "Common.class", Side: "common", Bytes: serverRefClass()})
	}
	report := AnalyzeMixins([]types.MixinFile{{Data: "{}", Registered: true, Classes: classes}})
	if report.Unknown != len(classes) || report.Risky != 0 {
		t.Fatalf("truncated scan treated as conclusive: %+v", report)
	}
}

func TestRefmapEnvironmentsAndObfuscation(t *testing.T) {
	data := []byte(`{"data":{"named:intermediary":{"a.B":{"m":"Lnet/minecraft/client/Minecraft;tick()V"}}}}`)
	if !refmapClientSet(data)["a/B"] {
		t.Fatal("environment mapping not read")
	}
	if len(refmapClientSet([]byte(`{"mappings":{"a/B":{"m":"Lnet/minecraft/class_310;method_123()V"}}}`))) != 0 {
		t.Fatal("obfuscated name guessed as client")
	}
}

func TestMixinMixedCommonClassDoesNotHideRisk(t *testing.T) {
	report := AnalyzeMixins([]types.MixinFile{{Name: "test", Data: "{}", Registered: true, Classes: []types.MixinClass{
		{Name: "Client.class", Side: "common", Bytes: clientRefClass()},
		{Name: "Common.class", Side: "common", Bytes: serverRefClass()},
	}}})
	if report.Risky != 1 {
		t.Fatalf("common class masked client risk: %+v", report)
	}
}
