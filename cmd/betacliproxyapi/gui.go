package main

import (
	"bytes"
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

//go:embed gui/index.html
var guiHTML embed.FS

func runGUI(args []string) {
	fs := flag.NewFlagSet("gui", flag.ExitOnError)
	port := fs.Int("port", 8318, "GUI port")
	noBrowser := fs.Bool("no-browser", false, "do not open browser")
	_ = fs.Parse(args)

	chosenPort, err := findAvailablePort(*port, 5)
	if err != nil {
		printError(err.Error())
		return
	}

	if chosenPort != *port {
		printWarning(fmt.Sprintf("Port %d busy, using %d", *port, chosenPort))
	}

	addr := fmt.Sprintf("127.0.0.1:%d", chosenPort)
	server := &http.Server{
		Addr:    addr,
		Handler: guiMux(),
	}

	if !*noBrowser {
		openBrowser(fmt.Sprintf("http://%s", addr))
	}

	printSuccess(fmt.Sprintf("GUI running at http://%s", addr))
	if err := server.ListenAndServe(); err != nil && !strings.Contains(err.Error(), "Server closed") {
		printError(fmt.Sprintf("GUI server error: %v", err))
	}
}

func guiMux() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/", handleGUI)
	mux.HandleFunc("/api/status", handleStatus)
	mux.HandleFunc("/api/auth-status", handleAuthStatus)
	mux.HandleFunc("/api/models", handleModels)
	mux.HandleFunc("/api/config", handleConfig)
	mux.HandleFunc("/api/start", handleStart)
	mux.HandleFunc("/api/stop", handleStop)
	mux.HandleFunc("/api/restart", handleRestart)
	mux.HandleFunc("/api/oauth/", handleOAuth)
	mux.HandleFunc("/api/stats", handleStats)
	mux.HandleFunc("/api/test", handleTestAPI)
	mux.HandleFunc("/api/playground", handlePlayground)
	mux.HandleFunc("/api/update/check", handleUpdateCheck)
	mux.HandleFunc("/api/update/apply", handleUpdateApply)
	mux.HandleFunc("/api/version", handleVersion)
	mux.HandleFunc("/api/factory-config", handleFactoryConfig)
	mux.HandleFunc("/api/factory-config/add", handleFactoryAdd)
	mux.HandleFunc("/api/factory-config/remove", handleFactoryRemove)
	return mux
}

func handleGUI(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	data, err := guiHTML.ReadFile("gui/index.html")
	if err != nil {
		http.Error(w, "GUI not available", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(data)
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, getServerStatus())
}

func handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, authStatus())
}

func handleModels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	port := resolvePortFromConfig(configPath(), 8317)
	models, err := fetchModels(port)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error(), "models": []string{}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "models": models})
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		data, err := os.ReadFile(configPath())
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error(), "content": ""})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "content": string(data)})
	case http.MethodPost:
		var payload struct {
			Content string `json:"content"`
		}
		if err := readJSONBody(r.Body, &payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid JSON"})
			return
		}
		if err := os.WriteFile(configPath(), []byte(payload.Content), 0o644); err != nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "message": "config saved"})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func handleStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := startServer(startOptions{Background: true}); err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	pid, _ := readPid()
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "pid": pid})
}

func handleStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := stopServer(); err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

func handleRestart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	_ = stopServer()
	if err := startServer(startOptions{Background: true}); err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	pid, _ := readPid()
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "pid": pid})
}

func handleOAuth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	provider := strings.TrimPrefix(r.URL.Path, "/api/oauth/")
	flag := oauthFlag(provider)
	if flag == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": "unknown provider"})
		return
	}
	cmd := exec.Command(binaryPath(), "--config", configPath(), flag)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	if err := cmd.Start(); err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

func oauthFlag(provider string) string {
	switch strings.ToLower(provider) {
	case "gemini":
		return "--login"
	case "antigravity":
		return "--antigravity-login"
	case "copilot":
		return "--github-copilot-login"
	case "codex":
		return "--codex-login"
	case "claude":
		return "--claude-login"
	case "qwen":
		return "--qwen-login"
	case "iflow":
		return "--iflow-login"
	case "kiro":
		return "--kiro-aws-login"
	default:
		return ""
	}
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		writeJSON(w, http.StatusOK, getRequestStats())
		return
	}
	if r.Method == http.MethodDelete {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "message": "stats reset not supported"})
		return
	}
	writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
}

func handleTestAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var payload struct {
		APIKey string `json:"apiKey"`
	}
	if err := readJSONBody(r.Body, &payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid JSON"})
		return
	}

	apiKey := strings.TrimSpace(payload.APIKey)
	if apiKey == "" {
		apiKey = "sk-dummy"
	}

	port := resolvePortFromConfig(configPath(), 8317)
	url := fmt.Sprintf("http://localhost:%d/v1/models", port)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 4 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body := readBodySnippet(resp.Body)
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": fmt.Sprintf("HTTP %s: %s", resp.Status, body)})
		return
	}

	var data struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	bodyBytes, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(bodyBytes, &data); err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"message": fmt.Sprintf("HTTP %s", resp.Status),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("HTTP %s, %d models", resp.Status, len(data.Data)),
	})
}

func handlePlayground(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var payload struct {
		Model       string  `json:"model"`
		System      string  `json:"system"`
		Prompt      string  `json:"prompt"`
		Temperature float64 `json:"temperature"`
		MaxTokens   int     `json:"maxTokens"`
		APIKey      string  `json:"apiKey"`
	}
	if err := readJSONBody(r.Body, &payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid JSON"})
		return
	}

	if strings.TrimSpace(payload.Model) == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": "model is required"})
		return
	}
	if strings.TrimSpace(payload.Prompt) == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": "prompt is required"})
		return
	}

	apiKey := strings.TrimSpace(payload.APIKey)
	if apiKey == "" {
		apiKey = "sk-dummy"
	}

	type message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	messages := []message{}
	if strings.TrimSpace(payload.System) != "" {
		messages = append(messages, message{Role: "system", Content: payload.System})
	}
	messages = append(messages, message{Role: "user", Content: payload.Prompt})

	reqBody := map[string]interface{}{
		"model":    payload.Model,
		"messages": messages,
	}
	if payload.MaxTokens > 0 {
		reqBody["max_tokens"] = payload.MaxTokens
	}
	if payload.Temperature >= 0 {
		reqBody["temperature"] = payload.Temperature
	}

	bodyBytes, _ := json.Marshal(reqBody)
	port := resolvePortFromConfig(configPath(), 8317)
	url := fmt.Sprintf("http://localhost:%d/v1/chat/completions", port)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body := readBodySnippet(resp.Body)
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": fmt.Sprintf("HTTP %s: %s", resp.Status, body)})
		return
	}

	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	raw, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(raw, &response); err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":  true,
			"response": string(raw),
		})
		return
	}
	text := ""
	if len(response.Choices) > 0 {
		text = response.Choices[0].Message.Content
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":  true,
		"response": text,
	})
}

func readBodySnippet(r io.Reader) string {
	data, err := io.ReadAll(io.LimitReader(r, 4096))
	if err != nil {
		return "failed to read response body"
	}
	msg := strings.TrimSpace(string(data))
	if msg == "" {
		return "no response body"
	}
	return msg
}

func handleUpdateCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	info := getUpdateInfo()
	writeJSON(w, http.StatusOK, info)
}

func handleUpdateApply(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	result := applyUpdate()
	writeJSON(w, http.StatusOK, result)
}

func handleVersion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	info := loadVersionInfo()
	writeJSON(w, http.StatusOK, info)
}

func handleFactoryConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	cfg, err := readFactoryConfig()
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error(), "models": []FactoryModelSummary{}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "models": summarizeFactoryModels(cfg)})
}

func handleFactoryAdd(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var payload struct {
		Models       []string          `json:"models"`
		DisplayNames map[string]string `json:"displayNames"`
	}
	if err := readJSONBody(r.Body, &payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid JSON"})
		return
	}
	added, err := addFactoryModels(payload.Models, payload.DisplayNames)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "added": added})
}

func handleFactoryRemove(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var payload struct {
		Models []string `json:"models"`
		All    bool     `json:"all"`
	}
	if err := readJSONBody(r.Body, &payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid JSON"})
		return
	}
	removed, err := removeFactoryModels(payload.Models, payload.All)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "removed": removed})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func findAvailablePort(start, attempts int) (int, error) {
	for i := 0; i < attempts; i++ {
		port := start + i
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err != nil {
			continue
		}
		_ = ln.Close()
		return port, nil
	}
	return 0, fmt.Errorf("no available port found")
}

func getRequestStats() map[string]interface{} {
	port := resolvePortFromConfig(configPath(), 8317)
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(fmt.Sprintf("http://localhost:%d/stats", port))
	if err == nil && resp.StatusCode >= 200 && resp.StatusCode < 300 {
		defer resp.Body.Close()
		var payload struct {
			TotalRequests      int     `json:"total_requests"`
			SuccessfulRequests int     `json:"successful_requests"`
			FailedRequests     int     `json:"failed_requests"`
			AvgLatencyMs       float64 `json:"avg_latency_ms"`
			StartTime          string  `json:"start_time"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&payload); err == nil {
			total := payload.TotalRequests
			success := payload.SuccessfulRequests
			errors := payload.FailedRequests
			var rate float64
			if total > 0 {
				rate = float64(success) / float64(total) * 100
			}
			return map[string]interface{}{
				"total":       total,
				"success":     success,
				"errors":      errors,
				"successRate": rate,
				"avgLatency":  payload.AvgLatencyMs,
				"lastReset":   payload.StartTime,
				"available":   true,
			}
		}
	}

	return map[string]interface{}{
		"total":       0,
		"success":     0,
		"errors":      0,
		"successRate": 0,
		"avgLatency":  0,
		"lastReset":   time.Now().Format(time.RFC3339),
		"available":   false,
		"message":     "Stats not available",
	}
}

func getUpdateInfo() UpdateInfo {
	local := loadVersionInfo()
	local = updateLastCheck(local)

	info := UpdateInfo{
		CurrentVersion: managerVersion,
		CurrentCommit:  local.CommitSha,
		RepoURL:        fmt.Sprintf("https://github.com/%s", cliProxyRepo),
	}

	release, err := fetchLatestRelease(cliProxyRepo)
	if err != nil {
		info.Error = err.Error()
		return info
	}

	asset, _ := selectReleaseAsset(release.Assets)
	if asset != nil {
		info.DownloadURL = asset.BrowserDownloadURL
	}

	info.LatestCommit = release.TagName
	info.LatestCommitDate = release.PublishedAt
	if release.Name != "" {
		info.LatestCommitMessage = release.Name
	} else {
		info.LatestCommitMessage = fmt.Sprintf("Release %s", release.TagName)
	}
	if local.CommitSha == "" || local.CommitSha == "unknown" {
		info.HasUpdate = true
	} else {
		info.HasUpdate = local.CommitSha != release.TagName
	}

	return info
}

func applyUpdate() map[string]interface{} {
	wasRunning := getServerStatus().Running
	if wasRunning {
		_ = stopServer()
		time.Sleep(500 * time.Millisecond)
	}

	tag, date, err := downloadAndInstallBinary(true)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	if err := writeVersionInfo(tag, date); err != nil {
		printWarning(fmt.Sprintf("Failed to update version info: %v", err))
	}

	if wasRunning {
		_ = startServer(startOptions{Background: true})
	}

	return map[string]interface{}{
		"success":       true,
		"newCommit":     tag,
		"commitMessage": fmt.Sprintf("Release %s", tag),
	}
}
