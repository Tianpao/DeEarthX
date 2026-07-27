package modloader

import (
	"fmt"

	"resty.dev/v3"
)

func NewForge(mcv, mlv, path string) *Forge {
	return &Forge{
		minecraft:     mcv,
		loaderVersion: mlv,
		path:          path,
		client:        resty.New(),
	}
}

type Forge struct {
	minecraft     string
	loaderVersion string
	path          string
	client        *resty.Client
}

func (this *Forge) Setup() error {
	this.Installer()
	url := fmt.Sprintf("forge/download?mcversion=%s&version=%s&category=installer&format=jar", this.minecraft, this.loaderVersion)

	return nil
}

func (this *Forge) Installer() error {
	return nil
}

func (this *Forge) Install() error {
	return nil
}
