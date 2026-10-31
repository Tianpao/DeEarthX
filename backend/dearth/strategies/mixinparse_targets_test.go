package strategies

import (
	"reflect"
	"testing"
)

type targetAnnoPair struct {
	name string
	elem []byte
}

func targetElem(tag byte, index int) []byte { return append([]byte{tag}, u2(index)...) }
func targetArray(elems ...[]byte) []byte {
	b := append([]byte{'['}, u2(len(elems))...)
	for _, e := range elems {
		b = append(b, e...)
	}
	return b
}
func targetAnnotation(c *cp, desc string, pairs ...targetAnnoPair) []byte {
	b := append(u2(c.addUtf8(desc)), u2(len(pairs))...)
	for _, pair := range pairs {
		b = append(b, u2(c.addUtf8(pair.name))...)
		b = append(b, pair.elem...)
	}
	return b
}
func targetInt(c *cp, value int) int {
	i := c.n
	c.n++
	c.buf = append(c.buf, 3)
	c.buf = append(c.buf, u4(value)...)
	return i
}
func targetFixture() []byte {
	c := newCP()
	attr := c.addUtf8("RuntimeVisibleAnnotations")
	a := targetAnnotation(c, "Lorg/spongepowered/asm/mixin/Mixin;",
		targetAnnoPair{"value", targetArray(targetElem('c', c.addUtf8("Lnet/minecraft/client/Minecraft;")), targetElem('c', c.addUtf8("Lnet/minecraft/server/MinecraftServer;")))},
		targetAnnoPair{"targets", targetArray(targetElem('s', c.addUtf8("net.minecraft.client.gui.Gui$Inner")), targetElem('s', c.addUtf8("com/mojang/blaze3d/RenderSystem")))},
		targetAnnoPair{"remap", targetElem('Z', targetInt(c, 0))},
	)
	return buildClass(c, runtimeVisibleAnnos(attr, a))
}

func TestParseMixinTargets(t *testing.T) {
	info := parseMixinClass(targetFixture())
	want := []string{"net/minecraft/client/Minecraft", "net/minecraft/server/MinecraftServer", "net/minecraft/client/gui/Gui$Inner", "com/mojang/blaze3d/RenderSystem"}
	if info == nil {
		t.Fatal("valid @Mixin returned nil")
	}
	if !reflect.DeepEqual(info.targets, want) {
		t.Fatalf("targets = %q; want %q", info.targets, want)
	}
	if !info.remapDisabled {
		t.Error("remap=false not recorded")
	}
	if info.referencesClient || info.classEnvClient || info.memberEnvClient {
		t.Error("target metadata must not masquerade as member reference or dist annotation")
	}
}

func TestParseMixinNamedTargetsWithoutRefmap(t *testing.T) {
	for _, attrName := range []string{"RuntimeVisibleAnnotations", "RuntimeInvisibleAnnotations"} {
		for _, remap := range []int{0, 1} {
			c := newCP()
			attr := c.addUtf8(attrName)
			a := targetAnnotation(c, "Lorg/spongepowered/asm/mixin/Mixin;",
				targetAnnoPair{"targets", targetArray(targetElem('s', c.addUtf8("net.minecraft.client.Minecraft")))},
				targetAnnoPair{"remap", targetElem('Z', targetInt(c, remap))},
			)
			b := buildClass(c, runtimeVisibleAnnos(attr, a))
			b[6], b[7] = 0, 69 // Java 25 / Minecraft 26.1+: named targets, no refmap
			info := parseMixinClass(b)
			if info == nil || !reflect.DeepEqual(info.targets, []string{"net/minecraft/client/Minecraft"}) || info.remapDisabled != (remap == 0) {
				t.Fatalf("%s remap=%d: %+v", attrName, remap, info)
			}
		}
	}
}

func TestParseMixinNoArbitraryStringEvidence(t *testing.T) {
	c := newCP()
	c.addUtf8("net/minecraft/client/Minecraft")
	c.addUtf8("Lnet/minecraft/client/Minecraft;")
	c.addUtf8("net.minecraft.client.Minecraft")
	// Even a CONSTANT_String referencing client-looking text is not a class.
	index := c.addUtf8("com/mojang/blaze3d/RenderSystem")
	c.n++
	c.buf = append(c.buf, 8)
	c.buf = append(c.buf, u2(index)...)
	attr := c.addUtf8("RuntimeVisibleAnnotations")
	a := targetAnnotation(c, "Lexample/Unrelated;",
		targetAnnoPair{"targets", targetArray(targetElem('s', index))},
		targetAnnoPair{"remap", targetElem('Z', targetInt(c, 0))},
	)
	info := parseMixinClass(buildClass(c, runtimeVisibleAnnos(attr, a)))
	if info == nil {
		t.Fatal("valid unrelated strings rejected")
	}
	if info.referencesClient || info.classEnvClient || info.memberEnvClient || info.remapDisabled || len(info.targets) != 0 {
		t.Fatalf("arbitrary text became evidence: %+v", info)
	}
}

func TestParseMixinClassConstantEvidence(t *testing.T) {
	c := newCP()
	c.addClass(c.addUtf8("net/minecraft/client/Minecraft"))
	info := parseMixinClass(buildClass(c))
	if info == nil || !info.referencesClient {
		t.Fatal("actual class reference should count as client evidence")
	}
}

func TestParseMixinNeoForgeOnlyIn(t *testing.T) {
	for _, member := range []bool{false, true} {
		c := newCP()
		attr := c.addUtf8("RuntimeInvisibleAnnotations")
		a := envClientAnno(c.addUtf8("Lnet/neoforged/api/distmarker/OnlyIn;"), c.addUtf8("value"), c.addUtf8("Lnet/neoforged/api/distmarker/Dist;"), c.addUtf8("CLIENT"))
		attribute := runtimeVisibleAnnos(attr, a)
		var b []byte
		if !member {
			b = buildClass(c, attribute)
		} else {
			name, desc := c.addUtf8("render"), c.addUtf8("()V")
			b = buildClass(c)
			// Replace methods_count + class attributes_count with a single method.
			b = b[:len(b)-4]
			b = append(b, u2(1)...)
			b = append(b, u2(0)...)
			b = append(b, u2(name)...)
			b = append(b, u2(desc)...)
			b = append(b, u2(1)...)
			b = append(b, attribute...)
			b = append(b, u2(0)...)
		}
		info := parseMixinClass(b)
		if info == nil || info.classEnvClient != !member || info.memberEnvClient != member {
			t.Fatalf("member=%v: %+v", member, info)
		}
	}
}

func TestParseMixinTruncatedReturnsNil(t *testing.T) {
	for _, b := range [][]byte{targetFixture(), clientRefClass(), envClientAnnotatedClass(), pseudoAnnotatedClientRefClass()} {
		if parseMixinClass(b) == nil {
			t.Fatal("invalid test fixture")
		}
		for n := 0; n < len(b); n++ {
			if info := parseMixinClass(b[:n]); info != nil {
				t.Fatalf("length %d/%d returned partial info: %+v", n, len(b), info)
			}
		}
	}
}

func TestParseMixinInvalidIndices(t *testing.T) {
	for _, index := range []int{0, 65535} {
		t.Run(string(rune('A'+index%26)), func(t *testing.T) {
			fixtures := map[string][]byte{}
			c := newCP()
			c.addClass(index)
			fixtures["class name"] = buildClass(c)
			c = newCP()
			nat := c.addNameAndType(c.addUtf8("m"), c.addUtf8("()V"))
			c.addMethodref(index, nat)
			fixtures["member owner"] = buildClass(c)
			c = newCP()
			owner := c.addClass(c.addUtf8("net/minecraft/client/Minecraft"))
			c.addMethodref(owner, index)
			fixtures["member name and type"] = buildClass(c)
			c = newCP()
			c.addNameAndType(index, c.addUtf8("()V"))
			fixtures["name and type name"] = buildClass(c)
			c = newCP()
			attr := c.addUtf8("RuntimeVisibleAnnotations")
			valid := pseudoAnno(c.addUtf8("Lorg/spongepowered/asm/mixin/Pseudo;"))
			fixtures["attribute name"] = buildClass(c, runtimeVisibleAnnos(index, valid))
			fixtures["annotation type"] = buildClass(c, runtimeVisibleAnnos(attr, pseudoAnno(index)))
			a := append(u2(c.addUtf8("Lorg/spongepowered/asm/mixin/Mixin;")), u2(1)...)
			a = append(a, u2(index)...)
			a = append(a, targetElem('s', c.addUtf8("x"))...)
			fixtures["element name"] = buildClass(c, runtimeVisibleAnnos(attr, a))
			for _, tag := range []byte{'c', 's', 'Z', 'e'} {
				c = newCP()
				attr = c.addUtf8("RuntimeVisibleAnnotations")
				mode := "targets"
				if tag == 'c' {
					mode = "value"
				}
				if tag == 'Z' {
					mode = "remap"
				}
				elem := targetElem(tag, index)
				if tag == 'e' {
					elem = append(elem, u2(index)...)
				}
				a = targetAnnotation(c, "Lorg/spongepowered/asm/mixin/Mixin;", targetAnnoPair{mode, targetArray(elem)})
				fixtures["element "+string(tag)] = buildClass(c, runtimeVisibleAnnos(attr, a))
			}
			for name, b := range fixtures {
				if info := parseMixinClass(b); info != nil {
					t.Errorf("%s index %d: %+v", name, index, info)
				}
			}
		})
	}
	// In-range wrong-tag indices must fail too, not silently resolve to empty text.
	c := newCP()
	wrong := targetInt(c, 0)
	c.addClass(wrong)
	if parseMixinClass(buildClass(c)) != nil {
		t.Fatal("class name accepted non-Utf8 entry")
	}
	c = newCP()
	wrong = c.addUtf8("not a Class")
	nat := c.addNameAndType(c.addUtf8("m"), c.addUtf8("()V"))
	c.addMethodref(wrong, nat)
	if parseMixinClass(buildClass(c)) != nil {
		t.Fatal("member owner accepted non-Class entry")
	}
}

func TestParseMixinMalformedAttributeBoundaries(t *testing.T) {
	c := newCP()
	attr := c.addUtf8("RuntimeVisibleAnnotations")
	a := pseudoAnno(c.addUtf8("Lorg/spongepowered/asm/mixin/Pseudo;"))
	valid := runtimeVisibleAnnos(attr, a)
	for _, length := range []int{0, 1, 2, len(valid) - 7, len(valid) - 5, -1} {
		corrupt := append([]byte(nil), valid...)
		copy(corrupt[2:6], u4(length))
		if parseMixinClass(buildClass(c, corrupt)) != nil {
			t.Errorf("accepted malformed annotation attribute length %d", length)
		}
	}
	// A complete earlier client annotation cannot rescue a later malformed one.
	broken := append(u2(c.addUtf8("Lexample/Other;")), u2(1)...)
	if parseMixinClass(buildClass(c, runtimeVisibleAnnos(attr, a, broken))) != nil {
		t.Fatal("returned partial annotation evidence")
	}
}

func TestParseMixinUnknownElementTagAndDeepArray(t *testing.T) {
	for _, deep := range []bool{false, true} {
		c := newCP()
		attr := c.addUtf8("RuntimeVisibleAnnotations")
		elem := []byte{'?'}
		if deep {
			elem = targetElem('s', c.addUtf8("x"))
			for i := 0; i < 140; i++ {
				elem = targetArray(elem)
			}
		}
		a := targetAnnotation(c, "Lexample/Other;", targetAnnoPair{"x", elem})
		if parseMixinClass(buildClass(c, runtimeVisibleAnnos(attr, a))) != nil {
			t.Fatalf("accepted unknown/deep element, deep=%v", deep)
		}
	}
}

func TestParseMixinWrongTargetShapes(t *testing.T) {
	for _, name := range []string{"value", "targets", "remap"} {
		c := newCP()
		attr := c.addUtf8("RuntimeVisibleAnnotations")
		text := c.addUtf8("Lnet/minecraft/client/Minecraft;")
		enum := append(targetElem('e', text), u2(c.addUtf8("CLIENT"))...)
		nested := append([]byte{'@'}, pseudoAnno(c.addUtf8("Lorg/spongepowered/asm/mixin/Pseudo;"))...)
		for _, elem := range [][]byte{enum, nested, targetElem('s', text), targetArray(targetArray(targetElem('s', text)))} {
			a := targetAnnotation(c, "Lorg/spongepowered/asm/mixin/Mixin;", targetAnnoPair{name, elem})
			if parseMixinClass(buildClass(c, runtimeVisibleAnnos(attr, a))) != nil {
				t.Errorf("accepted malformed %s element %x", name, elem)
			}
		}
	}
}

func FuzzParseMixinTargets(f *testing.F) {
	for _, b := range [][]byte{nil, {0xCA, 0xFE, 0xBA, 0xBE}, targetFixture(), clientRefClass(), serverRefClass(), envClientAnnotatedClass(), pseudoAnnotatedClientRefClass()} {
		f.Add(b)
	}
	b := targetFixture()
	for _, n := range []int{9, len(b) / 2, len(b) - 1} {
		f.Add(b[:n])
	}
	c := newCP()
	c.addClass(65535)
	f.Add(buildClass(c))
	c = newCP()
	attr := c.addUtf8("RuntimeVisibleAnnotations")
	a := targetAnnotation(c, "Lorg/spongepowered/asm/mixin/Mixin;", targetAnnoPair{"targets", targetArray(targetElem('s', 65535))})
	f.Add(buildClass(c, runtimeVisibleAnnos(attr, a)))
	f.Fuzz(func(t *testing.T, data []byte) { parseMixinClass(data) })
}
