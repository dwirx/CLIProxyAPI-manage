package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type FactoryModel struct {
	ModelDisplayName string `json:"model_display_name"`
	Model            string `json:"model"`
	BaseURL          string `json:"base_url"`
	APIKey           string `json:"api_key"`
	Provider         string `json:"provider"`
}

type FactoryConfig struct {
	CustomModels []FactoryModel `json:"custom_models"`
}

type FactoryModelSummary struct {
	Model       string `json:"model"`
	DisplayName string `json:"display_name"`
	BaseURL     string `json:"base_url"`
}

func defaultFactoryConfig() FactoryConfig {
	baseURL := "http://localhost:8317/v1"
	apiKey := "sk-dummy"
	provider := "openai"
	return FactoryConfig{CustomModels: []FactoryModel{
		{ModelDisplayName: "Claude Opus 4.5 Thinking [Antigravity]", Model: "gemini-claude-opus-4-5-thinking", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "Claude Sonnet 4.5 Thinking [Antigravity]", Model: "gemini-claude-sonnet-4-5-thinking", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "Claude Sonnet 4.5 [Antigravity]", Model: "gemini-claude-sonnet-4-5", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "Gemini 3 Pro [Antigravity]", Model: "gemini-3-pro-preview", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "GPT OSS 120B [Antigravity]", Model: "gpt-oss-120b-medium", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "Claude Opus 4.5 [Copilot]", Model: "claude-opus-4.5", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "GPT-5 Mini [Copilot]", Model: "gpt-5-mini", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "Grok Code Fast 1 [Copilot]", Model: "grok-code-fast-1", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "Gemini 2.5 Pro [Gemini]", Model: "gemini-2.5-pro", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "Gemini 3 Pro Preview [Gemini]", Model: "gemini-3-pro-preview", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "GPT-5.1 Codex Max [Codex]", Model: "gpt-5.1-codex-max", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "Qwen3 Coder Plus [Qwen]", Model: "qwen3-coder-plus", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "GLM 4.6 [iFlow]", Model: "glm-4.6", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "Minimax M2 [iFlow]", Model: "minimax-m2", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "Claude Opus 4.5 [Kiro]", Model: "kiro-claude-opus-4.5", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "Claude Sonnet 4.5 [Kiro]", Model: "kiro-claude-sonnet-4.5", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "Claude Sonnet 4 [Kiro]", Model: "kiro-claude-sonnet-4", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
		{ModelDisplayName: "Claude Haiku 4.5 [Kiro]", Model: "kiro-claude-haiku-4.5", BaseURL: baseURL, APIKey: apiKey, Provider: provider},
	}}
}

func writeFactoryConfig(cfg FactoryConfig) error {
	if err := ensureDir(factoryDir()); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(factoryConfigPath(), data, 0o644)
}

func readFactoryConfig() (FactoryConfig, error) {
	if !fileExists(factoryConfigPath()) {
		return FactoryConfig{CustomModels: []FactoryModel{}}, nil
	}
	data, err := os.ReadFile(factoryConfigPath())
	if err != nil {
		return FactoryConfig{}, err
	}
	var cfg FactoryConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return FactoryConfig{}, err
	}
	if cfg.CustomModels == nil {
		cfg.CustomModels = []FactoryModel{}
	}
	return cfg, nil
}

func summarizeFactoryModels(cfg FactoryConfig) []FactoryModelSummary {
	models := make([]FactoryModelSummary, 0, len(cfg.CustomModels))
	for _, item := range cfg.CustomModels {
		models = append(models, FactoryModelSummary{
			Model:       item.Model,
			DisplayName: item.ModelDisplayName,
			BaseURL:     item.BaseURL,
		})
	}
	return models
}

func addFactoryModels(models []string, displayNames map[string]string) ([]string, error) {
	cfg, err := readFactoryConfig()
	if err != nil {
		return nil, err
	}

	existing := map[string]bool{}
	for _, item := range cfg.CustomModels {
		existing[item.Model] = true
	}

	added := []string{}
	for _, model := range models {
		if model == "" || existing[model] {
			continue
		}
		displayName := model
		if name, ok := displayNames[model]; ok {
			displayName = name
		}
		cfg.CustomModels = append(cfg.CustomModels, FactoryModel{
			ModelDisplayName: displayName,
			Model:            model,
			BaseURL:          "http://localhost:8317/v1",
			APIKey:           "sk-dummy",
			Provider:         "openai",
		})
		existing[model] = true
		added = append(added, model)
	}

	if err := writeFactoryConfig(cfg); err != nil {
		return nil, err
	}
	return added, nil
}

func removeFactoryModels(models []string, removeAll bool) ([]string, error) {
	cfg, err := readFactoryConfig()
	if err != nil {
		return nil, err
	}

	if removeAll {
		removed := make([]string, 0, len(cfg.CustomModels))
		for _, item := range cfg.CustomModels {
			removed = append(removed, item.Model)
		}
		cfg.CustomModels = []FactoryModel{}
		if err := writeFactoryConfig(cfg); err != nil {
			return nil, err
		}
		return removed, nil
	}

	removeSet := map[string]bool{}
	for _, model := range models {
		removeSet[model] = true
	}

	filtered := make([]FactoryModel, 0, len(cfg.CustomModels))
	removed := []string{}
	for _, item := range cfg.CustomModels {
		if removeSet[item.Model] {
			removed = append(removed, item.Model)
			continue
		}
		filtered = append(filtered, item)
	}
	cfg.CustomModels = filtered
	if err := writeFactoryConfig(cfg); err != nil {
		return nil, err
	}
	return removed, nil
}

func clearFactoryConfig() error {
	cfg, err := readFactoryConfig()
	if err != nil {
		return err
	}
	cfg.CustomModels = []FactoryModel{}
	return writeFactoryConfig(cfg)
}

func ensureFactoryConfigExists() error {
	if fileExists(factoryConfigPath()) {
		return nil
	}
	cfg := FactoryConfig{CustomModels: []FactoryModel{}}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	if err := ensureDir(factoryDir()); err != nil {
		return err
	}
	return os.WriteFile(factoryConfigPath(), data, 0o644)
}

func formatFactorySummary(cfg FactoryConfig) string {
	return fmt.Sprintf("%d custom models", len(cfg.CustomModels))
}
