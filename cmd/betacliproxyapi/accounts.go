package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type accountInfo struct {
	ID       string `json:"id"`
	Provider string `json:"provider"`
	Email    string `json:"email"`
	LastUsed string `json:"lastUsed"`
	Current  bool   `json:"current"`
	Disabled bool   `json:"disabled"`
}

var accountPatterns = map[string]string{
	"gemini":      "gemini-*.json",
	"copilot":     "github-copilot-*.json",
	"antigravity": "antigravity-*.json",
	"codex":       "codex-*.json",
	"claude":      "claude-*.json",
	"qwen":        "qwen-*.json",
	"iflow":       "iflow-*.json",
	"kiro":        "kiro-*.json",
}

const accountDisabledSuffix = ".disabled"

func handleAccounts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	accounts := listAccounts()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":  true,
		"accounts": accounts,
	})
}

func handleAccountDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var payload struct {
		ID string `json:"id"`
	}
	if err := readJSONBody(r.Body, &payload); err != nil || strings.TrimSpace(payload.ID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid JSON"})
		return
	}
	path, err := safeAccountPath(payload.ID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	if err := os.Remove(path); err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

func handleAccountSetCurrent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var payload struct {
		IDs []string `json:"ids"`
		ID  string   `json:"id"`
	}
	if err := readJSONBody(r.Body, &payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid JSON"})
		return
	}
	ids := payload.IDs
	if len(ids) == 0 && strings.TrimSpace(payload.ID) != "" {
		ids = []string{payload.ID}
	}
	if len(ids) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "error": "no accounts selected"})
		return
	}
	now := time.Now()
	updated := 0
	for i, id := range ids {
		if strings.HasSuffix(id, accountDisabledSuffix) {
			continue
		}
		ts := now.Add(time.Millisecond * time.Duration(i))
		if err := touchAccount(id, ts); err == nil {
			updated++
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"updated": updated,
	})
}

func handleAccountDisable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	ids, err := readAccountIDs(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	updated := 0
	for _, id := range ids {
		if err := disableAccount(id); err == nil {
			updated++
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "updated": updated})
}

func handleAccountEnable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	ids, err := readAccountIDs(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	updated := 0
	for _, id := range ids {
		if err := enableAccount(id); err == nil {
			updated++
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "updated": updated})
}

func readAccountIDs(r *http.Request) ([]string, error) {
	var payload struct {
		IDs []string `json:"ids"`
		ID  string   `json:"id"`
	}
	if err := readJSONBody(r.Body, &payload); err != nil {
		return nil, errors.New("invalid JSON")
	}
	ids := payload.IDs
	if len(ids) == 0 && strings.TrimSpace(payload.ID) != "" {
		ids = []string{payload.ID}
	}
	if len(ids) == 0 {
		return nil, errors.New("no accounts selected")
	}
	return ids, nil
}

func safeAccountPath(id string) (string, error) {
	clean := filepath.Base(strings.TrimSpace(id))
	if clean == "" || clean != id {
		return "", errors.New("invalid account id")
	}
	if strings.HasSuffix(clean, accountDisabledSuffix) {
		base := strings.TrimSuffix(clean, accountDisabledSuffix)
		if !strings.HasSuffix(base, ".json") {
			return "", errors.New("invalid account file")
		}
	} else if !strings.HasSuffix(clean, ".json") {
		return "", errors.New("invalid account file")
	}
	full := filepath.Join(configDir(), clean)
	configRoot := filepath.Clean(configDir()) + string(os.PathSeparator)
	if !strings.HasPrefix(filepath.Clean(full)+string(os.PathSeparator), configRoot) {
		return "", errors.New("invalid account path")
	}
	if !fileExists(full) {
		return "", errors.New("account file not found")
	}
	return full, nil
}

func touchAccount(id string, ts time.Time) error {
	if strings.HasSuffix(id, accountDisabledSuffix) {
		return errors.New("account disabled")
	}
	path, err := safeAccountPath(id)
	if err != nil {
		return err
	}
	return os.Chtimes(path, ts, ts)
}

func disableAccount(id string) error {
	if strings.HasSuffix(id, accountDisabledSuffix) {
		return nil
	}
	path, err := safeAccountPath(id)
	if err != nil {
		return err
	}
	return os.Rename(path, path+accountDisabledSuffix)
}

func enableAccount(id string) error {
	if !strings.HasSuffix(id, accountDisabledSuffix) {
		return nil
	}
	path, err := safeAccountPath(id)
	if err != nil {
		return err
	}
	enabledPath := strings.TrimSuffix(path, accountDisabledSuffix)
	return os.Rename(path, enabledPath)
}

func listAccounts() []accountInfo {
	entries := []accountInfo{}
	latestByProvider := map[string]time.Time{}
	latestID := map[string]string{}

	for provider, pattern := range accountPatterns {
		matches := []string{}
		activeMatches, _ := filepath.Glob(filepath.Join(configDir(), pattern))
		disabledMatches, _ := filepath.Glob(filepath.Join(configDir(), pattern+accountDisabledSuffix))
		matches = append(matches, activeMatches...)
		matches = append(matches, disabledMatches...)
		for _, match := range matches {
			info, err := os.Stat(match)
			if err != nil {
				continue
			}
			email := parseAccountEmail(match)
			if email == "" {
				email = "Unknown"
			}
			id := filepath.Base(match)
			lastUsed := info.ModTime()
			disabled := strings.HasSuffix(id, accountDisabledSuffix)
			entries = append(entries, accountInfo{
				ID:       id,
				Provider: provider,
				Email:    email,
				LastUsed: lastUsed.Format(time.RFC3339),
				Current:  false,
				Disabled: disabled,
			})
			if !disabled {
				if latestTime, ok := latestByProvider[provider]; !ok || lastUsed.After(latestTime) {
					latestByProvider[provider] = lastUsed
					latestID[provider] = id
				}
			}
		}
	}

	for i := range entries {
		if latestID[entries[i].Provider] == entries[i].ID {
			entries[i].Current = true
		}
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Provider != entries[j].Provider {
			return entries[i].Provider < entries[j].Provider
		}
		if entries[i].Disabled != entries[j].Disabled {
			return !entries[i].Disabled
		}
		return entries[i].LastUsed > entries[j].LastUsed
	})

	return entries
}

func parseAccountEmail(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return ""
	}
	return findStringValue(payload, 0)
}

func findStringValue(data map[string]interface{}, depth int) string {
	if depth > 3 {
		return ""
	}
	keys := []string{
		"email",
		"mail",
		"username",
		"user",
		"account",
		"login",
		"preferred_username",
	}
	for _, key := range keys {
		if value, ok := data[key]; ok {
			if str, ok := value.(string); ok {
				if strings.Contains(str, "@") {
					return str
				}
			}
			if nested, ok := value.(map[string]interface{}); ok {
				if found := findStringValue(nested, depth+1); found != "" {
					return found
				}
			}
		}
	}
	for _, value := range data {
		if nested, ok := value.(map[string]interface{}); ok {
			if found := findStringValue(nested, depth+1); found != "" {
				return found
			}
		}
	}
	return ""
}
