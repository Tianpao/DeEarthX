package dearth

import (
	"archive/zip"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"sort"
	"testing"

	"dex/backend/dearth/types"
)

func mixinTestJar(t *testing.T, entries map[string][]byte) []byte {
	t.Helper()
	var b bytes.Buffer
	w := zip.NewWriter(&b)
	var names []string
	for name := range entries {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		f, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := f.Write(entries[name]); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

// A valid minimal Java 26 class (major version 70), without a refmap.
func mixinTestClass() []byte {
	var b bytes.Buffer
	put := func(v uint16) { _ = binary.Write(&b, binary.BigEndian, v) }
	b.Write([]byte{0xca, 0xfe, 0xba, 0xbe})
	put(0)
	put(70)
	put(5)
	for _, name := range []string{"example/Mixin", "java/lang/Object"} {
		b.WriteByte(1)
		put(uint16(len(name)))
		b.WriteString(name)
		b.WriteByte(7)
		if name == "example/Mixin" {
			put(1)
		} else {
			put(3)
		}
	}
	for _, v := range []uint16{0x21, 2, 4, 0, 0, 0, 0} {
		put(v)
	}
	return b.Bytes()
}

func mixinTestByName(files []types.MixinFile) map[string]types.MixinFile {
	out := make(map[string]types.MixinFile)
	for _, f := range files {
		out[f.Name] = f
	}
	return out
}

func TestExtractMixinsGroupsWithoutRefmap26_1(t *testing.T) {
	entries := map[string][]byte{
		"fabric.mod.json":       []byte(`{"mixins":["arbitrary-config.json"]}`),
		"arbitrary-config.json": []byte(`{"package":"example","mixins":["Common","Shared"],"server":["Server","Both"],"client":["Client","Shared","Both"]}`),
	}
	for _, name := range []string{"Common", "Server", "Client", "Shared", "Both"} {
		entries["example/"+name+".class"] = mixinTestClass()
	}
	files := extractMixins(mixinTestJar(t, entries))
	if len(files) != 1 {
		t.Fatalf("configs = %d", len(files))
	}
	f := files[0]
	if !f.Registered || f.Environment != "common" || f.Incomplete || len(f.Refmap) != 0 {
		t.Fatalf("bad config: %+v", f)
	}
	want := map[string]string{"Common": "common", "Server": "server", "Client": "client", "Shared": "common", "Both": "common"}
	if len(f.Classes) != len(want) {
		t.Fatalf("classes = %d", len(f.Classes))
	}
	for _, cls := range f.Classes {
		name := cls.Name[len("example/") : len(cls.Name)-len(".class")]
		if cls.Side != want[name] || !bytes.Equal(cls.Bytes, mixinTestClass()) {
			t.Errorf("bad class: %+v", cls)
		}
	}
}

func TestExtractMixinsRegistrations(t *testing.T) {
	entries := map[string][]byte{
		"fabric.mod.json":          []byte(`{"mixins":["plain.json",{"config":"client.json","environment":"client"},{"config":"server.json","environment":"server"},{"config":"both.json","environment":"client"},"both.json",{"config":"reverse.json"},{"config":"reverse.json","environment":"client"},{"config":"manifest.json","environment":"client"},{"config":"wildcard.json","environment":"*"},"absent.json"]}`),
		"META-INF/MANIFEST.MF":     []byte("Manifest-Version: 1.0\r\nMixinConfigs: manifest.json, nested/con\r\n fig.json\r\n\r\n"),
		"mixins.unregistered.json": []byte(`{"environment":"client"}`),
	}
	want := map[string]string{"plain.json": "common", "client.json": "client", "server.json": "server", "both.json": "common", "reverse.json": "common", "manifest.json": "common", "nested/config.json": "common", "wildcard.json": "common", "absent.json": "common"}
	for name := range want {
		if name != "absent.json" {
			entries[name] = []byte("{}")
		}
	}
	files := mixinTestByName(extractMixins(mixinTestJar(t, entries)))
	if len(files) != len(want)+1 {
		t.Fatalf("configs = %d", len(files))
	}
	for name, env := range want {
		f, ok := files[name]
		if !ok || !f.Registered || f.Environment != env || f.Incomplete != (name == "absent.json") {
			t.Errorf("registration %s = %+v", name, f)
		}
	}
	if f := files["mixins.unregistered.json"]; f.Registered || f.Environment != "common" {
		t.Errorf("discovered config = %+v", f)
	}
}

func TestExtractMixinsIncomplete(t *testing.T) {
	entries := map[string][]byte{
		"fabric.mod.json":    []byte(`{"mixins":["broken.json","missing-class.json","bounded.json"]}`),
		"broken.json":        []byte("{broken"),
		"missing-class.json": []byte(`{"client":["Absent"]}`),
	}
	var names []string
	for i := 0; i < maxMixinClassesPerConfig+1; i++ {
		name := fmt.Sprintf("Mixin%d", i)
		names = append(names, name)
		entries[name+".class"] = mixinTestClass()
	}
	data, err := json.Marshal(map[string]any{"server": names, "client": []string{names[0]}})
	if err != nil {
		t.Fatal(err)
	}
	entries["bounded.json"] = data
	files := mixinTestByName(extractMixins(mixinTestJar(t, entries)))
	for _, name := range []string{"broken.json", "missing-class.json", "bounded.json"} {
		if !files[name].Incomplete {
			t.Errorf("%s must be incomplete", name)
		}
	}
	bounded := files["bounded.json"]
	if len(bounded.Classes) != maxMixinClassesPerConfig || bounded.Classes[0].Side != "common" {
		t.Fatalf("bounded result = %+v", bounded)
	}
	// Exactly the limit is complete, and duplicates do not count toward the cap.
	data, err = json.Marshal(map[string]any{"client": names[:maxMixinClassesPerConfig]})
	if err != nil {
		t.Fatal(err)
	}
	entries["bounded.json"] = data
	bounded = mixinTestByName(extractMixins(mixinTestJar(t, entries)))["bounded.json"]
	if bounded.Incomplete || len(bounded.Classes) != maxMixinClassesPerConfig {
		t.Fatalf("exact limit = %+v", bounded)
	}
}
