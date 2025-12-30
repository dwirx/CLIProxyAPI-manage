package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type QuotaRule struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Match       string `json:"match"`
	LimitTokens int    `json:"limitTokens"`
}

type quotaConfig struct {
	Rules []QuotaRule `json:"rules"`
}

func quotaConfigPath() string {
	return filepath.Join(configDir(), "quota.json")
}

func defaultQuotaRules() []QuotaRule {
	return []QuotaRule{
		{ID: "gemini", Label: "Gemini", Match: "gemini", LimitTokens: 1_000_000},
		{ID: "gemini-image", Label: "Gemini Image", Match: "image", LimitTokens: 500_000},
		{ID: "claude", Label: "Claude", Match: "claude", LimitTokens: 1_000_000},
	}
}

func loadQuotaRules() ([]QuotaRule, error) {
	path := quotaConfigPath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return defaultQuotaRules(), nil
		}
		return defaultQuotaRules(), err
	}
	var cfg quotaConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return defaultQuotaRules(), err
	}
	rules := normalizeQuotaRules(cfg.Rules)
	if len(rules) == 0 {
		return defaultQuotaRules(), nil
	}
	return rules, nil
}

func saveQuotaRules(rules []QuotaRule) error {
	if err := ensureDir(configDir()); err != nil {
		return err
	}
	clean := normalizeQuotaRules(rules)
	if len(clean) == 0 {
		clean = defaultQuotaRules()
	}
	payload := quotaConfig{Rules: clean}
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(quotaConfigPath(), data, 0644)
}

func normalizeQuotaRules(rules []QuotaRule) []QuotaRule {
	clean := make([]QuotaRule, 0, len(rules))
	for i, rule := range rules {
		id := strings.TrimSpace(rule.ID)
		label := strings.TrimSpace(rule.Label)
		match := strings.TrimSpace(rule.Match)
		limit := rule.LimitTokens
		if limit < 0 {
			limit = 0
		}
		if id == "" {
			if label != "" {
				id = slugify(label)
			}
			if id == "" {
				id = fmt.Sprintf("rule-%d", i+1)
			}
		}
		if label == "" {
			label = id
		}
		clean = append(clean, QuotaRule{
			ID:          id,
			Label:       label,
			Match:       match,
			LimitTokens: limit,
		})
	}
	return clean
}

func slugify(value string) string {
	lower := strings.ToLower(strings.TrimSpace(value))
	if lower == "" {
		return ""
	}
	var b strings.Builder
	lastDash := false
	for _, ch := range lower {
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') {
			b.WriteRune(ch)
			lastDash = false
			continue
		}
		if !lastDash {
			b.WriteByte('-')
			lastDash = true
		}
	}
	result := strings.Trim(b.String(), "-")
	return result
}
