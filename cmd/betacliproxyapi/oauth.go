package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type oauthProvider struct {
	Name string
	Flag string
	Key  string
}

var oauthProviders = []oauthProvider{
	{Name: "Gemini CLI", Flag: "--login", Key: "gemini"},
	{Name: "Antigravity", Flag: "--antigravity-login", Key: "antigravity"},
	{Name: "GitHub Copilot", Flag: "--github-copilot-login", Key: "copilot"},
	{Name: "Codex", Flag: "--codex-login", Key: "codex"},
	{Name: "Claude", Flag: "--claude-login", Key: "claude"},
	{Name: "Qwen", Flag: "--qwen-login", Key: "qwen"},
	{Name: "iFlow", Flag: "--iflow-login", Key: "iflow"},
	{Name: "Kiro (AWS)", Flag: "--kiro-aws-login", Key: "kiro"},
}

func runOAuth(args []string) {
	fs := flag.NewFlagSet("oauth", flag.ExitOnError)
	all := fs.Bool("all", false, "login to all providers")
	gemini := fs.Bool("gemini", false, "login to Gemini")
	antigravity := fs.Bool("antigravity", false, "login to Antigravity")
	copilot := fs.Bool("copilot", false, "login to Copilot")
	codex := fs.Bool("codex", false, "login to Codex")
	claude := fs.Bool("claude", false, "login to Claude")
	qwen := fs.Bool("qwen", false, "login to Qwen")
	iflow := fs.Bool("iflow", false, "login to iFlow")
	kiro := fs.Bool("kiro", false, "login to Kiro")
	_ = fs.Parse(args)

	if !fileExists(binaryPath()) {
		printError("cliproxyapi-plus binary not found, run install first")
		os.Exit(1)
	}
	if !fileExists(configPath()) {
		printError("config.yaml not found, run install first")
		os.Exit(1)
	}

	any := *all || *gemini || *antigravity || *copilot || *codex || *claude || *qwen || *iflow || *kiro
	if any {
		for _, provider := range oauthProviders {
			switch provider.Key {
			case "gemini":
				if *all || *gemini {
					runOAuthLogin(provider)
				}
			case "antigravity":
				if *all || *antigravity {
					runOAuthLogin(provider)
				}
			case "copilot":
				if *all || *copilot {
					runOAuthLogin(provider)
				}
			case "codex":
				if *all || *codex {
					runOAuthLogin(provider)
				}
			case "claude":
				if *all || *claude {
					runOAuthLogin(provider)
				}
			case "qwen":
				if *all || *qwen {
					runOAuthLogin(provider)
				}
			case "iflow":
				if *all || *iflow {
					runOAuthLogin(provider)
				}
			case "kiro":
				if *all || *kiro {
					runOAuthLogin(provider)
				}
			}
		}
		return
	}

	interactiveOAuthMenu()
}

func runOAuthLogin(provider oauthProvider) {
	printStep(fmt.Sprintf("Logging in to %s", provider.Name))
	cmd := exec.Command(binaryPath(), "--config", configPath(), provider.Flag)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	if err := cmd.Run(); err != nil {
		printWarning(fmt.Sprintf("%s login returned error: %v", provider.Name, err))
	} else {
		printSuccess(fmt.Sprintf("%s login completed", provider.Name))
	}
}

func interactiveOAuthMenu() {
	fmt.Println("==========================================")
	fmt.Println("  CLIProxyAPIPlus OAuth Login Menu")
	fmt.Println("==========================================")
	for i, provider := range oauthProviders {
		fmt.Printf("  %d. %s\n", i+1, provider.Name)
	}
	fmt.Println("  A. Login to ALL providers")
	fmt.Println("  Q. Quit")
	fmt.Println("")

	reader := bufio.NewReader(os.Stdin)
	for {
		fmt.Print("Select provider(s) [1-8, A, or Q]: ")
		choice, _ := reader.ReadString('\n')
		choice = strings.TrimSpace(choice)

		if strings.EqualFold(choice, "q") {
			printSuccess("Bye!")
			return
		}

		if strings.EqualFold(choice, "a") {
			for _, provider := range oauthProviders {
				runOAuthLogin(provider)
			}
			printSuccess("All logins completed")
			return
		}

		selections := strings.Split(choice, ",")
		for _, sel := range selections {
			sel = strings.TrimSpace(sel)
			idx := -1
			_, err := fmt.Sscanf(sel, "%d", &idx)
			if err != nil || idx < 1 || idx > len(oauthProviders) {
				printWarning(fmt.Sprintf("Invalid selection: %s", sel))
				continue
			}
			runOAuthLogin(oauthProviders[idx-1])
		}
	}
}

func authStatus() map[string]bool {
	patterns := map[string]string{
		"gemini":      "gemini-*.json",
		"copilot":     "github-copilot-*.json",
		"antigravity": "antigravity-*.json",
		"codex":       "codex-*.json",
		"claude":      "claude-*.json",
		"qwen":        "qwen-*.json",
		"iflow":       "iflow-*.json",
		"kiro":        "kiro-*.json",
	}

	status := map[string]bool{}
	authDir := resolveAuthDir()
	statusByType := authTypesInDir(authDir)
	for key, pattern := range patterns {
		if statusByType[key] {
			status[key] = true
			continue
		}
		matches, _ := filepath.Glob(filepath.Join(authDir, pattern))
		status[key] = len(matches) > 0
	}
	return status
}

func resolveAuthDir() string {
	fallback := configDir()
	data, err := os.ReadFile(configPath())
	if err != nil {
		return fallback
	}

	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if !strings.HasPrefix(line, "auth-dir:") {
			continue
		}
		value := strings.TrimSpace(strings.TrimPrefix(line, "auth-dir:"))
		if idx := strings.Index(value, "#"); idx != -1 {
			value = strings.TrimSpace(value[:idx])
		}
		value = strings.Trim(value, "\"'")
		if value == "" {
			return fallback
		}
		value = expandHome(value)
		if !filepath.IsAbs(value) {
			value = filepath.Join(fallback, value)
		}
		return filepath.Clean(value)
	}
	return fallback
}

func expandHome(path string) string {
	if path == "" {
		return path
	}
	if path == "~" {
		return homeDir()
	}
	if strings.HasPrefix(path, "~/") || strings.HasPrefix(path, "~\\") {
		return filepath.Join(homeDir(), path[2:])
	}
	return path
}

func authTypesInDir(authDir string) map[string]bool {
	status := map[string]bool{}
	entries, err := os.ReadDir(authDir)
	if err != nil {
		return status
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".json") {
			continue
		}
		full := filepath.Join(authDir, name)
		data, err := os.ReadFile(full)
		if err != nil {
			continue
		}
		var meta struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(data, &meta); err != nil {
			continue
		}
		provider, ok := normalizeAuthType(meta.Type)
		if !ok {
			continue
		}
		status[provider] = true
	}
	return status
}

func normalizeAuthType(value string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "github-copilot", "copilot":
		return "copilot", true
	case "openai", "codex":
		return "codex", true
	case "gemini", "google":
		return "gemini", true
	case "antigravity":
		return "antigravity", true
	case "claude", "anthropic":
		return "claude", true
	case "qwen":
		return "qwen", true
	case "iflow":
		return "iflow", true
	case "kiro", "kiro-aws":
		return "kiro", true
	default:
		return "", false
	}
}
