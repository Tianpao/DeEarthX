package strategies

import (
	"strings"
)

// mixinClassInfo is the result of statically inspecting a single mixin class
// file. It mirrors the signals Arclight's ModJarParser reads out of the class
// constant pool and annotations, without depending on ASM.
type mixinClassInfo struct {
	referencesClient bool // constant pool references net/minecraft/client/** or com/mojang/blaze3d/**
	classEnvClient   bool // class-level @Environment(CLIENT) / @OnlyIn(CLIENT)
	memberEnvClient  bool // any field/method-level @Environment(CLIENT) / @OnlyIn(CLIENT)
	pseudo           bool // @Pseudo: missing target is tolerated
}

// clientClassPrefixes are the byte-prefixes of client-only code owners.
// A reference to any of these is treated as "this mixin touches client code".
var clientClassPrefixes = []string{
	"net/minecraft/client/",
	"com/mojang/blaze3d/",
}

// parseMixinClass reads a class file's constant pool and class-level annotations
// to decide whether the mixin references client code or is dist-annotated.
// It returns nil on any parse failure (treat as "no evidence" rather than a miss).
func parseMixinClass(data []byte) *mixinClassInfo {
	c := &classCursor{d: data}
	if len(data) < 8 || c.u4() != 0xCAFEBABE {
		return nil
	}
	c.u2() // minor
	c.u2() // major

	cpCount := c.u2()
	utf := make([]string, cpCount)
	clsName := make([]int, cpCount) // CONSTANT_Class -> name_index
	refCls := make([]int, cpCount)  // Field/Method/InterfaceMethodref -> class_index

	for i := 1; i < cpCount; i++ {
		tag := c.u1()
		switch tag {
		case 1: // Utf8
			length := c.u2()
			if length < 0 || c.p+length > len(data) {
				return nil
			}
			utf[i] = string(data[c.p : c.p+length])
			c.p += length
		case 7: // Class
			clsName[i] = c.u2()
		case 8, 16, 19, 20: // String / MethodType / Module / Package
			c.p += 2
		case 15: // MethodHandle
			c.p += 3
		case 9, 10, 11: // Fieldref / Methodref / InterfaceMethodref
			refCls[i] = c.u2()
			c.p += 2
		case 3, 4, 12, 17, 18: // int / float / NameAndType / Dynamic / InvokeDynamic
			c.p += 4
		case 5, 6: // long / double (take two slots)
			c.p += 8
			i++
		default:
			return nil
		}
	}

	info := &mixinClassInfo{}
	for i := 1; i < cpCount && !info.referencesClient; i++ {
		ci := refCls[i]
		if ci <= 0 || ci >= cpCount {
			continue
		}
		owner := utf[clsName[ci]]
		if isClientOwner(owner) {
			info.referencesClient = true
		}
	}

	// Skip ahead: access_flags / this_class / super_class / interfaces / fields / methods / attributes.
	if c.p+6 > len(data) {
		return info
	}
	c.p += 6
	ifaceCount := c.u2()
	c.p += ifaceCount * 2
	for k := 0; k < 2; k++ { // fields, then methods
		n := c.u2()
		for i := 0; i < n; i++ {
			c.p += 6 // access_flags / name_index / descriptor_index
			if !readAttrs(c, utf, info, false) {
				return info
			}
		}
	}
	readAttrs(c, utf, info, true)
	return info
}

func isClientOwner(owner string) bool {
	for _, p := range clientClassPrefixes {
		if strings.HasPrefix(owner, p) {
			return true
		}
	}
	return false
}

// readAttrs walks the attribute table, extracting dist annotations from
// RuntimeVisible/RuntimeInvisibleAnnotations. Returns false on a malformed class.
func readAttrs(c *classCursor, utf []string, info *mixinClassInfo, classLevel bool) bool {
	an := c.u2()
	for i := 0; i < an; i++ {
		name := utf[c.u2()]
		length := c.u4()
		end := c.p + length
		if end < c.p || end > len(c.d) {
			return false
		}
		if name == "RuntimeVisibleAnnotations" || name == "RuntimeInvisibleAnnotations" {
			na := c.u2()
			for k := 0; k < na; k++ {
				if !readAnno(c, utf, info, classLevel) {
					return false
				}
			}
		}
		c.p = end
	}
	return true
}

func readAnno(c *classCursor, utf []string, info *mixinClassInfo, classLevel bool) bool {
	desc := utf[c.u2()]
	isEnv := desc == "Lnet/fabricmc/api/Environment;" || desc == "Lnet/minecraftforge/api/distmarker/OnlyIn;"
	if desc == "Lorg/spongepowered/asm/mixin/Pseudo;" {
		info.pseudo = true
	}
	np := c.u2()
	for i := 0; i < np; i++ {
		name := utf[c.u2()]
		if !readElem(c, utf, info, isEnv && (name == "value"), classLevel) {
			return false
		}
	}
	return true
}

func readElem(c *classCursor, utf []string, info *mixinClassInfo, envAnno, classLevel bool) bool {
	tag := c.u1()
	switch tag {
	case 'e': // Enum: @OnlyIn(Dist.CLIENT) / @Environment(EnvType.CLIENT)
		c.u2() // type_name_index
		constant := utf[c.u2()]
		if envAnno && constant == "CLIENT" {
			if classLevel {
				info.classEnvClient = true
			} else {
				info.memberEnvClient = true
			}
		}
	case '@': // nested annotation
		return readAnno(c, utf, info, classLevel)
	case '[': // array
		n := c.u2()
		for i := 0; i < n; i++ {
			if !readElem(c, utf, info, envAnno, classLevel) {
				return false
			}
		}
	default:
		// B C D F I J S Z: primitive constant pool index (2 bytes);
		// c/s: class/string element (we don't need them for env detection).
		c.p += 2
	}
	return true
}

// classCursor is a minimal read-only cursor over a class file's bytes.
type classCursor struct {
	d []byte
	p int
}

func (c *classCursor) u1() int {
	if c.p+1 > len(c.d) {
		return 0
	}
	v := int(c.d[c.p])
	c.p++
	return v
}

func (c *classCursor) u2() int {
	if c.p+2 > len(c.d) {
		c.p = len(c.d)
		return 0
	}
	v := int(c.d[c.p])<<8 | int(c.d[c.p+1])
	c.p += 2
	return v
}

func (c *classCursor) u4() int {
	if c.p+4 > len(c.d) {
		c.p = len(c.d)
		return 0
	}
	v := int(c.d[c.p])<<24 | int(c.d[c.p+1])<<16 | int(c.d[c.p+2])<<8 | int(c.d[c.p+3])
	c.p += 4
	return v
}