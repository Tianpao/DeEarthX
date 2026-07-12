package information

import (
	"dex/backend/utils"

	"encoding/json"

	"resty.dev/v3"
)

type SponsorService struct {
	client *resty.Client
}

type Sponsor struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	ImageURL string `json:"imageUrl"`
	URL      string `json:"url"`
	Tone     string `json:"tone"` // "gold" | "silver" | "bronze"
}

func (super *SponsorService) SponsorAd() any {
	value := utils.NewMemoryCache().Get("Sponsor")
	if value != nil {
		return value
	}
	res, _ := resty.New().R().SetHeader("User-Agent", "DeEarthX").Get("https://galaxy.tianpao.top/sponsor/")
	var sponsors []Sponsor
	json.Unmarshal(res.Bytes(), &sponsors)
	return sponsors
}
