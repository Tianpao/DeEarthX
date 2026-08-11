package strategies

import (
	"testing"

	"dex/backend/dearth/types"
)

// --- minimal class-file builders (hand-rolled, no ASM) ---

func u2(v int) []byte { return []byte{byte(v >> 8), byte(v)} }
func u4(v int) []byte { return []byte{byte(v >> 24), byte(v >> 16), byte(v >> 8), byte(v)} }

// cp builds a constant pool and returns the pool bytes plus the count of entries.
type cp struct {
	buf []byte
	n   int
	utf map[string]int
}

// newCP reserves constant pool index 0 (the spec requires it to be unused).
func newCP() *cp { return &cp{n: 1, utf: map[string]int{}} }

func (c *cp) addUtf8(s string) int {
	if i, ok := c.utf[s]; ok {
		return i
	}
	i := c.n
	c.n++
	c.buf = append(c.buf, 1)
	c.buf = append(c.buf, u2(len(s))...)
	c.buf = append(c.buf, []byte(s)...)
	c.utf[s] = i
	return i
}

func (c *cp) addClass(nameIdx int) int {
	i := c.n
	c.n++
	c.buf = append(c.buf, 7)
	c.buf = append(c.buf, u2(nameIdx)...)
	return i
}

func (c *cp) addNameAndType(nameIdx, descIdx int) int {
	i := c.n
	c.n++
	c.buf = append(c.buf, 12)
	c.buf = append(c.buf, u2(nameIdx)...)
	c.buf = append(c.buf, u2(descIdx)...)
	return i
}

func (c *cp) addMethodref(classIdx, natIdx int) int {
	i := c.n
	c.n++
	c.buf = append(c.buf, 10)
	c.buf = append(c.buf, u2(classIdx)...)
	c.buf = append(c.buf, u2(natIdx)...)
	return i
}

// buildClass assembles a minimal valid class file (access_flags=ACC_SUPER,
// no fields/methods) with the given constant pool and class attributes.
func buildClass(c *cp, attrs ...[]byte) []byte {
	var b []byte
	b = append(b, 0xCA, 0xFE, 0xBA, 0xBE, 0x00, 0x00, 0x00, 0x36) // magic + minor + major(52)
	b = append(b, u2(c.n)...)                                     // constant_pool_count (index 0 reserved)
	b = append(b, c.buf...)
	b = append(b, u2(0x0020)...) // access_flags
	b = append(b, u2(2)...)      // this_class
	b = append(b, u2(2)...)      // super_class
	b = append(b, u2(0)...)      // interfaces_count
	b = append(b, u2(0)...)      // fields_count
	b = append(b, u2(0)...)      // methods_count
	b = append(b, u2(len(attrs))...)
	for _, a := range attrs {
		b = append(b, a...)
	}
	return b
}

// runtimeVisibleAnnos wraps one or more annotation bodies into a
// RuntimeVisibleAnnotations attribute.
func runtimeVisibleAnnos(attrNameIdx int, annos ...[]byte) []byte {
	var inner []byte
	inner = append(inner, u2(len(annos))...)
	for _, a := range annos {
		inner = append(inner, a...)
	}
	attr := u2(attrNameIdx)
	attr = append(attr, u4(len(inner))...)
	attr = append(attr, inner...)
	return attr
}

// envClientAnno builds an @Environment(EnvType.CLIENT) annotation body.
func envClientAnno(descIdx, valueNameIdx, envTypeIdx, clientIdx int) []byte {
	var a []byte
	a = append(a, u2(descIdx)...) // type_index
	a = append(a, u2(1)...)       // num_element_value_pairs
	a = append(a, u2(valueNameIdx)...)
	a = append(a, 'e') // element tag: enum
	a = append(a, u2(envTypeIdx)...)
	a = append(a, u2(clientIdx)...)
	return a
}

// pseudoAnno builds an @Pseudo annotation body (no element pairs).
func pseudoAnno(descIdx int) []byte {
	a := u2(descIdx)
	a = append(a, u2(0)...) // num_element_value_pairs
	return a
}

// --- fixtures ---

func clientRefClass() []byte {
	c := newCP()
	clientName := c.addUtf8("net/minecraft/client/minecraft/Minecraft")
	clientClass := c.addClass(clientName)
	nat := c.addNameAndType(c.addUtf8("run"), c.addUtf8("()V"))
	c.addMethodref(clientClass, nat)
	return buildClass(c)
}

func serverRefClass() []byte {
	c := newCP()
	serverName := c.addUtf8("net/minecraft/server/MinecraftServer")
	serverClass := c.addClass(serverName)
	nat := c.addNameAndType(c.addUtf8("tick"), c.addUtf8("()V"))
	c.addMethodref(serverClass, nat)
	return buildClass(c)
}

func envClientAnnotatedClass() []byte {
	c := newCP()
	attrName := c.addUtf8("RuntimeVisibleAnnotations")
	envDesc := c.addUtf8("Lnet/fabricmc/api/Environment;")
	envType := c.addUtf8("Lnet/fabricmc/api/EnvType;")
	valueName := c.addUtf8("value")
	client := c.addUtf8("CLIENT")
	anno := envClientAnno(envDesc, valueName, envType, client)
	attr := runtimeVisibleAnnos(attrName, anno)
	return buildClass(c, attr)
}

func pseudoAnnotatedClientRefClass() []byte {
	c := newCP()
	attrName := c.addUtf8("RuntimeVisibleAnnotations")
	pseudoDesc := c.addUtf8("Lorg/spongepowered/asm/mixin/Pseudo;")
	clientName := c.addUtf8("net/minecraft/client/foo/Bar")
	clientClass := c.addClass(clientName)
	nat := c.addNameAndType(c.addUtf8("init"), c.addUtf8("()V"))
	c.addMethodref(clientClass, nat)
	attr := runtimeVisibleAnnos(attrName, pseudoAnno(pseudoDesc))
	return buildClass(c, attr)
}

func TestParseMixinClass(t *testing.T) {
	tests := []struct {
		name       string
		data       []byte
		wantClient bool
		wantEnv    bool
		wantPseudo bool
	}{
		{"client methodref", clientRefClass(), true, false, false},
		{"server methodref", serverRefClass(), false, false, false},
		{"env client annotation", envClientAnnotatedClass(), false, true, false},
		{"pseudo + client ref", pseudoAnnotatedClientRefClass(), true, false, true},
		{"garbage bytes", []byte{0x01, 0x02, 0x03}, false, false, false},
		{"empty", nil, false, false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := parseMixinClass(tt.data)
			if info == nil {
				if tt.wantClient || tt.wantEnv || tt.wantPseudo {
					t.Fatalf("expected non-nil info, got nil")
				}
				return
			}
			if info.referencesClient != tt.wantClient {
				t.Errorf("referencesClient = %v, want %v", info.referencesClient, tt.wantClient)
			}
			if info.classEnvClient != tt.wantEnv {
				t.Errorf("classEnvClient = %v, want %v", info.classEnvClient, tt.wantEnv)
			}
			if info.pseudo != tt.wantPseudo {
				t.Errorf("pseudo = %v, want %v", info.pseudo, tt.wantPseudo)
			}
		})
	}
}

func TestIsClientOnlyByMixin(t *testing.T) {
	serverSafe := types.MixinFile{
		Name: "server.mixins.json",
		Data: `{"package":"com.x","mixins":["ServerMixin"]}`,
		Classes: []types.MixinClass{
			{Name: "com/x/ServerMixin.class", Bytes: serverRefClass()},
		},
	}
	clientOnly := types.MixinFile{
		Name: "client.mixins.json",
		Data: `{"package":"com.x","client":["ClientMixin"],"environment":"CLIENT"}`,
		Classes: []types.MixinClass{
			{Name: "com/x/ClientMixin.class", Bytes: clientRefClass()},
		},
	}
	clientByRef := types.MixinFile{
		Name: "mod.mixins.json",
		Data: `{"package":"com.x","client":["ClientMixin"]}`,
		Classes: []types.MixinClass{
			{Name: "com/x/ClientMixin.class", Bytes: clientRefClass()},
		},
	}
	dual := types.MixinFile{
		Name: "mod.mixins.json",
		Data: `{"package":"com.x","mixins":["ServerMixin"],"client":["ClientMixin"]}`,
		Classes: []types.MixinClass{
			{Name: "com/x/ServerMixin.class", Bytes: serverRefClass()},
			{Name: "com/x/ClientMixin.class", Bytes: clientRefClass()},
		},
	}
	pluginFiltered := types.MixinFile{
		Name: "mod.mixins.json",
		Data: `{"package":"com.x","client":["ClientMixin"],"plugin":"com.x.Plugin"}`,
		Classes: []types.MixinClass{
			{Name: "com/x/ClientMixin.class", Bytes: clientRefClass()},
		},
	}
	optional := types.MixinFile{
		Name: "mod.mixins.json",
		Data: `{"package":"com.x","client":["ClientMixin"],"required":false}`,
		Classes: []types.MixinClass{
			{Name: "com/x/ClientMixin.class", Bytes: clientRefClass()},
		},
	}
	// refmap-only client: bytecode is clean, but the refmap maps the mixin to a
	// client-only target class.
	refmapOnlyClient := types.MixinFile{
		Name:   "mod.mixins.json",
		Data:   `{"package":"com.x","client":["ClientMixin"]}`,
		Refmap: []byte(`{"mappings":{"com/x/ClientMixin":{"m":"Lnet/minecraft/client/Minecraft;m_1_()V"}}}`),
		Classes: []types.MixinClass{
			{Name: "com/x/ClientMixin.class", Bytes: buildClass(newCP())},
		},
	}
	// dual-side via refmap: one mixin targets a client class, one a common class.
	refmapDual := types.MixinFile{
		Name: "mod.mixins.json",
		Data: `{"package":"com.x","mixins":["ServerMixin"],"client":["ClientMixin"]}`,
		Refmap: []byte(`{"mappings":{"com/x/ServerMixin":{"m":"Lnet/minecraft/world/entity/LivingEntity;m_1_()V"},"com/x/ClientMixin":{"m":"Lnet/minecraft/client/Minecraft;m_1_()V"}}}`),
		Classes: []types.MixinClass{
			{Name: "com/x/ServerMixin.class", Bytes: buildClass(newCP())},
			{Name: "com/x/ClientMixin.class", Bytes: buildClass(newCP())},
		},
	}
	// refmap absent: bytecode-only fallback still catches a client ref.
	refmapAbsent := types.MixinFile{
		Name: "mod.mixins.json",
		Data: `{"package":"com.x","client":["ClientMixin"]}`,
		Classes: []types.MixinClass{
			{Name: "com/x/ClientMixin.class", Bytes: clientRefClass()},
		},
	}

	tests := []struct {
		name  string
		mixin types.MixinFile
		want  bool
	}{
		{"server-only mixin kept", serverSafe, false},
		{"config declares client", clientOnly, true},
		{"client mixin verified by bytecode", clientByRef, true},
		{"dual-side kept", dual, false},
		{"plugin-filtered skipped", pluginFiltered, false},
		{"optional mixin skipped", optional, false},
		{"client caught by refmap only", refmapOnlyClient, true},
		{"dual-side kept by refmap", refmapDual, false},
		{"refmap absent falls back to bytecode", refmapAbsent, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isClientOnlyByMixin([]types.MixinFile{tt.mixin}); got != tt.want {
				t.Errorf("isClientOnlyByMixin = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRefmapClientSet(t *testing.T) {
	tests := []struct {
		name   string
		refmap []byte
		want   map[string]bool
	}{
		{"nil", nil, nil},
		{"empty", []byte{}, nil},
		{"garbage", []byte("not json"), nil},
		{
			"client target",
			[]byte(`{"mappings":{"a/B":{"m":"Lnet/minecraft/client/Minecraft;m_1_()V"}}}`),
			map[string]bool{"a/B": true},
		},
		{
			"common target",
			[]byte(`{"mappings":{"a/B":{"m":"Lnet/minecraft/world/entity/LivingEntity;m_1_()V"}}}`),
			nil,
		},
		{
			"non-class ref ignored",
			[]byte(`{"mappings":{"a/B":{"m":"methodName"}}}`),
			nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := refmapClientSet(tt.refmap)
			if tt.want == nil {
				if got != nil {
					t.Errorf("refmapClientSet = %v, want nil", got)
				}
				return
			}
			for k := range tt.want {
				if !got[k] {
					t.Errorf("refmapClientSet missing %q", k)
				}
			}
		})
	}
}