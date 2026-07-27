package modloader

import (
	"resty.dev/v3"
)

func NewMinceaft(mcv, mlv, path string) XModloader {
	return &Minecraft{
		minecraft:     mcv,
		loaderVersion: mlv,
		path:          path,
		client:        resty.New(),
	}
}

type Minecraft struct {
	minecraft     string
	loaderVersion string
	path          string
	client        *resty.Client
}

func (super *Minecraft) Setup() error {
	return nil
}

func (super *Minecraft) Installer() error {
	return nil
}
