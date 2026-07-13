package information

import (
	"dex/backend/utils"

	"encoding/json"

	"resty.dev/v3"
)

func NewSponsorService() *SponsorService {
	return &SponsorService{
		Cache: utils.NewMemoryCache(),
	}
}

type SponsorService struct {
	Cache *utils.MemoryCache
}

type Sponsor struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	ImageURL string `json:"imageUrl"`
	URL      string `json:"url"`
	Tone     string `json:"tone"` // "gold" | "silver" | "bronze"
}

func (super *SponsorService) SponsorAd() any {
	value := super.Cache.Get("Sponsor")
	if value != nil {
		return value
	}
	res, _ := resty.New().R().SetHeader("User-Agent", "DeEarthX").Get("https://galaxy.tianpao.top/sponsor/")
	var sponsors []Sponsor
	json.Unmarshal(res.Bytes(), &sponsors)
	super.Cache.Set("Sponsor", sponsors)
	return sponsors
}
