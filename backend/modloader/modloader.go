package modloader

type XModloader interface {
	Setup() error
	Installer() error
}

func newModloader(ml string, mcv, mlv, path string) XModloader {
	switch ml {
	case "forge":
		return NewForge(mcv, mlv, path)
	case "neoforge":
		return NewNeoForge(mcv, mlv, path)
	case "fabric", "fabric-loader":
		return NewFabric(mcv, mlv, path)
	default:
		return NewMinceaft(mcv, mlv, path)
	}
}
