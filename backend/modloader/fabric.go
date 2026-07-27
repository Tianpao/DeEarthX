package modloader

import (
	"resty.dev/v3"
)

func NewFabric(mcv, mlv, path string) XModloader {
	return &Fabric{
		minecraft:     mcv,
		loaderVersion: mlv,
		path:          path,
		client:        resty.New(),
	}
}

type Fabric struct {
	minecraft     string
	loaderVersion string
	path          string
	client        *resty.Client
}

func (super *Fabric) Setup() error {
	return nil
}

func (super *Fabric) Installer() error {
	return nil
}

func (super *Fabric) Install() error {
	return nil
}
