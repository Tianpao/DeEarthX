package strategies

import "strings"

// mixinClassInfo contains only evidence from a completely parsed class file.
type mixinClassInfo struct {
	referencesClient bool // actual constant-pool class/member references to client owners
	classEnvClient   bool // class-level @Environment(CLIENT) / @OnlyIn(CLIENT)
	memberEnvClient  bool // field/method-level @Environment(CLIENT) / @OnlyIn(CLIENT)
	pseudo           bool
	targets          []string // @Mixin value/targets, normalized to internal (slash) names
	remapDisabled    bool     // @Mixin(remap=false); metadata, never side evidence
}

var clientClassPrefixes = []string{"net/minecraft/client/", "com/mojang/blaze3d/"}

func isClientOwner(owner string) bool {
	for _, p := range clientClassPrefixes {
		if strings.HasPrefix(owner, p) {
			return true
		}
	}
	return false
}

type mixinConstant struct {
	tag  int
	text string
	a, b int
}

type mixinPool []mixinConstant

func (p mixinPool) has(i int, tags ...int) bool {
	if i <= 0 || i >= len(p) {
		return false
	}
	for _, tag := range tags {
		if p[i].tag == tag {
			return true
		}
	}
	return false
}

func (p mixinPool) text(c *classCursor, i int) string {
	if !p.has(i, 1) {
		c.bad = true
		return ""
	}
	return p[i].text
}

// parseMixinClass deliberately is not a JVM verifier (legacy fixtures have a
// synthetic this_class/super_class). Every index we dereference is checked,
// however, and malformed/truncated input never returns partially trusted info.
func parseMixinClass(data []byte) *mixinClassInfo {
	c := &classCursor{d: data}
	if c.u4() != 0xCAFEBABE {
		return nil
	}
	c.u2()
	c.u2()
	count := c.u2()
	if c.bad || count == 0 {
		return nil
	}
	pool := make(mixinPool, count)
	for i := 1; i < count; i++ {
		e := &pool[i]
		e.tag = c.u1()
		switch e.tag {
		case 1:
			n := c.u2()
			e.text = string(c.take(n))
		case 3, 4:
			e.a = c.u4()
		case 5, 6:
			c.take(8)
			i++
			if i >= count {
				return nil
			}
		case 7, 8, 16, 19, 20:
			e.a = c.u2()
		case 9, 10, 11, 12, 17, 18:
			e.a, e.b = c.u2(), c.u2()
		case 15:
			e.a, e.b = c.u1(), c.u2()
		default:
			return nil
		}
		if c.bad {
			return nil
		}
	}
	info := &mixinClassInfo{}
	// Validate CP references, including unused entries: no unchecked indexing and
	// no accepting a corrupt pool just because earlier entries yielded evidence.
	for _, e := range pool[1:] {
		switch e.tag {
		case 7, 8, 16, 19, 20:
			if !pool.has(e.a, 1) {
				return nil
			}
			if e.tag == 7 && isClientOwner(pool[e.a].text) {
				info.referencesClient = true
			}
		case 9, 10, 11:
			if !pool.has(e.a, 7) || !pool.has(e.b, 12) {
				return nil
			}
		case 12:
			if !pool.has(e.a, 1) || !pool.has(e.b, 1) {
				return nil
			}
		case 17, 18:
			// a is a BootstrapMethods table index, not a constant-pool index.
			if !pool.has(e.b, 12) {
				return nil
			}
		case 15:
			valid := false
			switch e.a {
			case 1, 2, 3, 4:
				valid = pool.has(e.b, 9)
			case 5, 8:
				valid = pool.has(e.b, 10)
			case 6, 7:
				valid = pool.has(e.b, 10, 11)
			case 9:
				valid = pool.has(e.b, 11)
			}
			if !valid {
				return nil
			}
		}
	}
	c.take(6) // flags, this_class, super_class: intentionally not dereferenced
	interfaces := c.u2()
	for i := 0; i < interfaces; i++ {
		if !pool.has(c.u2(), 7) {
			return nil
		}
	}
	for k := 0; k < 2; k++ {
		n := c.u2()
		for i := 0; i < n; i++ {
			c.u2()
			pool.text(c, c.u2())
			pool.text(c, c.u2())
			if !readMixinAttrs(c, pool, info, false) {
				return nil
			}
		}
	}
	if !readMixinAttrs(c, pool, info, true) || c.bad || c.p != len(data) {
		return nil
	}
	return info
}

func readMixinAttrs(c *classCursor, pool mixinPool, info *mixinClassInfo, classLevel bool) bool {
	n := c.u2()
	for i := 0; i < n; i++ {
		name := pool.text(c, c.u2())
		length := c.u4()
		body := c.take(length)
		if c.bad {
			return false
		}
		if name != "RuntimeVisibleAnnotations" && name != "RuntimeInvisibleAnnotations" {
			continue
		}
		// A bounded child cursor cannot consume the next attribute as annotation data.
		a := &classCursor{d: body}
		count := a.u2()
		for j := 0; j < count; j++ {
			if !readMixinAnno(a, pool, info, classLevel, true, 0) {
				return false
			}
		}
		if a.bad || a.p != len(body) {
			return false
		}
	}
	return !c.bad
}

func readMixinAnno(c *classCursor, pool mixinPool, info *mixinClassInfo, classLevel, evidence bool, depth int) bool {
	if depth > 128 {
		return false
	}
	desc := pool.text(c, c.u2())
	env := evidence && (desc == "Lnet/fabricmc/api/Environment;" || desc == "Lnet/minecraftforge/api/distmarker/OnlyIn;" || desc == "Lnet/neoforged/api/distmarker/OnlyIn;")
	mixin := evidence && classLevel && desc == "Lorg/spongepowered/asm/mixin/Mixin;"
	if evidence && classLevel && desc == "Lorg/spongepowered/asm/mixin/Pseudo;" {
		info.pseudo = true
	}
	n := c.u2()
	for i := 0; i < n; i++ {
		name := pool.text(c, c.u2())
		mode := ""
		if env && name == "value" {
			mode = "env"
		}
		if mixin && (name == "value" || name == "targets" || name == "remap") {
			mode = name
			if name == "value" || name == "targets" {
				mode += "Array"
			}
		}
		if !readMixinElem(c, pool, info, mode, classLevel, depth+1) {
			return false
		}
	}
	return !c.bad
}

func readMixinElem(c *classCursor, pool mixinPool, info *mixinClassInfo, mode string, classLevel bool, depth int) bool {
	if depth > 128 {
		return false
	}
	tag := c.u1()
	switch tag {
	case 'e':
		if mode != "" && mode != "env" {
			return false
		}
		pool.text(c, c.u2())
		constant := pool.text(c, c.u2())
		if mode == "env" && constant == "CLIENT" {
			if classLevel {
				info.classEnvClient = true
			} else {
				info.memberEnvClient = true
			}
		}
	case '@':
		if mode != "" {
			return false
		}
		// A nested annotation is a value, not a class/member annotation of its own.
		return readMixinAnno(c, pool, info, classLevel, false, depth+1)
	case '[':
		switch mode {
		case "valueArray":
			mode = "value"
		case "targetsArray":
			mode = "targets"
		case "":
		default:
			return false
		}
		n := c.u2()
		for i := 0; i < n; i++ {
			if !readMixinElem(c, pool, info, mode, classLevel, depth+1) {
				return false
			}
		}
	case 'c', 's':
		text := pool.text(c, c.u2())
		if mode == "value" && tag == 'c' {
			if len(text) < 3 || text[0] != 'L' || text[len(text)-1] != ';' {
				return false
			}
			info.targets = append(info.targets, strings.ReplaceAll(text[1:len(text)-1], ".", "/"))
		} else if mode == "targets" && tag == 's' {
			if text == "" {
				return false
			}
			info.targets = append(info.targets, strings.ReplaceAll(text, ".", "/"))
		} else if mode != "" {
			return false
		}
	case 'B', 'C', 'I', 'S', 'Z', 'D', 'F', 'J':
		i := c.u2()
		want := 3
		switch tag {
		case 'D':
			want = 6
		case 'F':
			want = 4
		case 'J':
			want = 5
		}
		if !pool.has(i, want) {
			return false
		}
		if mode == "remap" {
			if tag != 'Z' || (pool[i].a != 0 && pool[i].a != 1) {
				return false
			}
			info.remapDisabled = pool[i].a == 0
		} else if mode != "" {
			return false
		}
	default:
		return false
	}
	return !c.bad
}

// classCursor has sticky failure: a missing byte cannot masquerade as zero.
type classCursor struct {
	d   []byte
	p   int
	bad bool
}

func (c *classCursor) take(n int) []byte {
	if c.bad || n < 0 || c.p < 0 || c.p > len(c.d) || n > len(c.d)-c.p {
		c.bad = true
		return nil
	}
	b := c.d[c.p : c.p+n]
	c.p += n
	return b
}
func (c *classCursor) u1() int {
	b := c.take(1)
	if b == nil {
		return 0
	}
	return int(b[0])
}
func (c *classCursor) u2() int {
	b := c.take(2)
	if b == nil {
		return 0
	}
	return int(b[0])<<8 | int(b[1])
}
func (c *classCursor) u4() int {
	b := c.take(4)
	if b == nil {
		return 0
	}
	return int(uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3]))
}
