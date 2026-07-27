package dearth

// MurmurHash2 computes the CurseForge-compatible MurmurHash2.
// CurseForge strips whitespace bytes (0x09, 0x0A, 0x0D, 0x20) before hashing,
// and uses seed=1.
func MurmurHash2(data []byte) uint32 {
	// Strip whitespace characters as CurseForge does
	filtered := make([]byte, 0, len(data))
	for _, b := range data {
		if b != 0x09 && b != 0x0A && b != 0x0D && b != 0x20 {
			filtered = append(filtered, b)
		}
	}

	length := len(filtered)
	if length == 0 {
		return 0
	}

	const (
		m    uint32 = 0x5BD1E995
		r    uint32 = 24
		seed uint32 = 1
	)

	h := seed ^ uint32(length)

	idx := 0
	for length >= 4 {
		k := uint32(filtered[idx]) | uint32(filtered[idx+1])<<8 | uint32(filtered[idx+2])<<16 | uint32(filtered[idx+3])<<24

		k *= m
		k ^= k >> r
		k *= m

		h *= m
		h ^= k

		idx += 4
		length -= 4
	}

	// Handle remaining bytes
	switch length {
	case 3:
		h ^= uint32(filtered[idx+2]) << 16
		fallthrough
	case 2:
		h ^= uint32(filtered[idx+1]) << 8
		fallthrough
	case 1:
		h ^= uint32(filtered[idx])
		h *= m
	}

	h ^= h >> 13
	h *= m
	h ^= h >> 15

	return h
}
