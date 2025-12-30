package main

import (
	"context"
	"database/sql"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type RequestLog struct {
	Timestamp        time.Time
	Source           string
	Model            string
	Provider         string
	AccountID        string
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
	LatencyMs        int64
	Success          bool
	Error            string
}

type AnalyticsTotals struct {
	Requests         int     `json:"requests"`
	PromptTokens     int     `json:"promptTokens"`
	CompletionTokens int     `json:"completionTokens"`
	TotalTokens      int     `json:"totalTokens"`
	AvgLatencyMs     float64 `json:"avgLatencyMs"`
	SuccessRate      float64 `json:"successRate"`
}

type AnalyticsPerDay struct {
	Date     string `json:"date"`
	Requests int    `json:"requests"`
	Tokens   int    `json:"tokens"`
}

type AnalyticsTopModel struct {
	Model    string `json:"model"`
	Provider string `json:"provider"`
	Requests int    `json:"requests"`
	Tokens   int    `json:"tokens"`
}

type AnalyticsSummary struct {
	Success   bool                `json:"success"`
	Totals    AnalyticsTotals     `json:"totals"`
	PerDay    []AnalyticsPerDay   `json:"perDay"`
	TopModels []AnalyticsTopModel `json:"topModels"`
	Error     string              `json:"error,omitempty"`
}

type AnalyticsRecentEntry struct {
	Timestamp   string `json:"timestamp"`
	Model       string `json:"model"`
	Provider    string `json:"provider"`
	TotalTokens int    `json:"totalTokens"`
	LatencyMs   int64  `json:"latencyMs"`
	Success     bool   `json:"success"`
	Error       string `json:"error,omitempty"`
}

type AnalyticsRecent struct {
	Success bool                   `json:"success"`
	Entries []AnalyticsRecentEntry `json:"entries"`
	Error   string                 `json:"error,omitempty"`
}

type ModelUsageEntry struct {
	Model            string `json:"model"`
	Provider         string `json:"provider"`
	PromptTokens     int    `json:"promptTokens"`
	CompletionTokens int    `json:"completionTokens"`
	TotalTokens      int    `json:"totalTokens"`
	Requests         int    `json:"requests"`
	LastUsed         string `json:"lastUsed"`
}

type AccountModelUsageEntry struct {
	AccountID        string `json:"accountId"`
	Model            string `json:"model"`
	Provider         string `json:"provider"`
	PromptTokens     int    `json:"promptTokens"`
	CompletionTokens int    `json:"completionTokens"`
	TotalTokens      int    `json:"totalTokens"`
	Requests         int    `json:"requests"`
	LastUsed         string `json:"lastUsed"`
}

var (
	analyticsOnce sync.Once
	analyticsDB   *sql.DB
	analyticsErr  error
)

func analyticsDBPath() string {
	return filepath.Join(configDir(), "dataproxy.db")
}

func getAnalyticsDB() (*sql.DB, error) {
	analyticsOnce.Do(func() {
		if err := ensureDir(configDir()); err != nil {
			analyticsErr = err
			return
		}
		db, err := openAnalyticsDB(analyticsDBPath())
		if err != nil {
			analyticsErr = err
			return
		}
		db.SetMaxOpenConns(1)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := db.ExecContext(ctx, `
			create table if not exists request_logs (
				id integer primary key autoincrement,
				ts text not null,
				source text,
				model text,
				provider text,
				account_id text,
				prompt_tokens integer,
				completion_tokens integer,
				total_tokens integer,
				latency_ms integer,
				success integer,
				error text
			);
			create index if not exists idx_request_logs_ts on request_logs(ts);
			create index if not exists idx_request_logs_model on request_logs(model);
		`); err != nil {
			analyticsErr = err
			_ = db.Close()
			return
		}
		if err := ensureRequestLogColumns(ctx, db); err != nil {
			analyticsErr = err
			_ = db.Close()
			return
		}
		analyticsDB = db
	})
	return analyticsDB, analyticsErr
}

func ensureRequestLogColumns(ctx context.Context, db *sql.DB) error {
	rows, err := db.QueryContext(ctx, `pragma table_info(request_logs);`)
	if err != nil {
		return err
	}
	defer rows.Close()

	columns := map[string]bool{}
	for rows.Next() {
		var cid int
		var name string
		var ctype string
		var notnull int
		var dflt sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err == nil {
			columns[name] = true
		}
	}

	if !columns["account_id"] {
		if _, err := db.ExecContext(ctx, `alter table request_logs add column account_id text;`); err != nil {
			return err
		}
		columns["account_id"] = true
	}
	if columns["account_id"] {
		_, _ = db.ExecContext(ctx, `create index if not exists idx_request_logs_account on request_logs(account_id);`)
	}
	return nil
}

func logRequest(entry RequestLog) {
	db, err := getAnalyticsDB()
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	accountID := entry.AccountID
	if accountID == "" {
		accountID = resolveAccountID(entry.Provider)
	}
	_, _ = db.ExecContext(ctx, `
		insert into request_logs (ts, source, model, provider, account_id, prompt_tokens, completion_tokens, total_tokens, latency_ms, success, error)
		values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		entry.Timestamp.Format(time.RFC3339),
		entry.Source,
		entry.Model,
		entry.Provider,
		accountID,
		entry.PromptTokens,
		entry.CompletionTokens,
		entry.TotalTokens,
		entry.LatencyMs,
		boolToInt(entry.Success),
		entry.Error,
	)
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func estimateTokens(text string) int {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return 0
	}
	count := float64(len([]rune(trimmed)))
	return int(math.Ceil(count / 4.0))
}

func inferProvider(model string) string {
	lower := strings.ToLower(model)
	if strings.Contains(lower, "antigravity") {
		return "Antigravity"
	}
	if strings.HasPrefix(lower, "gemini") {
		return "Google"
	}
	if strings.HasPrefix(lower, "claude") {
		return "Anthropic"
	}
	if strings.HasPrefix(lower, "gpt") || strings.HasPrefix(lower, "o1") {
		return "OpenAI"
	}
	if strings.HasPrefix(lower, "qwen") {
		return "Qwen"
	}
	if strings.HasPrefix(lower, "kiro") {
		return "Kiro"
	}
	return "Unknown"
}

func resolveAccountID(provider string) string {
	key := providerKeyFromName(provider)
	if key == "" {
		return ""
	}
	pattern, ok := accountPatterns[key]
	if !ok {
		return ""
	}
	matches, _ := filepath.Glob(filepath.Join(configDir(), pattern))
	var latest string
	var latestTime time.Time
	for _, match := range matches {
		if strings.HasSuffix(match, accountDisabledSuffix) {
			continue
		}
		info, err := os.Stat(match)
		if err != nil {
			continue
		}
		if latest == "" || info.ModTime().After(latestTime) {
			latest = match
			latestTime = info.ModTime()
		}
	}
	if latest == "" {
		return ""
	}
	return filepath.Base(latest)
}

func providerKeyFromName(provider string) string {
	lower := strings.ToLower(provider)
	switch {
	case strings.Contains(lower, "antigravity"):
		return "antigravity"
	case strings.Contains(lower, "gemini"), strings.Contains(lower, "google"):
		return "gemini"
	case strings.Contains(lower, "claude"), strings.Contains(lower, "anthropic"):
		return "claude"
	case strings.Contains(lower, "openai"), strings.Contains(lower, "codex"):
		return "codex"
	case strings.Contains(lower, "copilot"):
		return "copilot"
	case strings.Contains(lower, "qwen"):
		return "qwen"
	case strings.Contains(lower, "iflow"):
		return "iflow"
	case strings.Contains(lower, "kiro"):
		return "kiro"
	default:
		return ""
	}
}

func getAnalyticsSummary() AnalyticsSummary {
	db, err := getAnalyticsDB()
	if err != nil {
		return AnalyticsSummary{Success: false, Error: err.Error()}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	totals := AnalyticsTotals{}
	var successCount int
	error := db.QueryRowContext(ctx, `
		select
			count(*),
			coalesce(sum(prompt_tokens), 0),
			coalesce(sum(completion_tokens), 0),
			coalesce(sum(total_tokens), 0),
			coalesce(avg(latency_ms), 0),
			coalesce(sum(case when success = 1 then 1 else 0 end), 0)
		from request_logs
	`).Scan(
		&totals.Requests,
		&totals.PromptTokens,
		&totals.CompletionTokens,
		&totals.TotalTokens,
		&totals.AvgLatencyMs,
		&successCount,
	)
	if error != nil {
		return AnalyticsSummary{Success: false, Error: error.Error()}
	}

	if totals.Requests > 0 {
		totals.SuccessRate = (float64(successCount) / float64(totals.Requests)) * 100
	}

	perDay := []AnalyticsPerDay{}
	since := time.Now().AddDate(0, 0, -6).Format(time.RFC3339)
	rows, err := db.QueryContext(ctx, `
		select substr(ts, 1, 10) as day, count(*), coalesce(sum(total_tokens), 0)
		from request_logs
		where ts >= ?
		group by day
		order by day asc
	`, since)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var day string
			var requests int
			var tokens int
			if err := rows.Scan(&day, &requests, &tokens); err == nil {
				perDay = append(perDay, AnalyticsPerDay{Date: day, Requests: requests, Tokens: tokens})
			}
		}
	}

	topModels := []AnalyticsTopModel{}
	modelRows, err := db.QueryContext(ctx, `
		select model, provider, count(*), coalesce(sum(total_tokens), 0)
		from request_logs
		where model != ''
		group by model, provider
		order by sum(total_tokens) desc
		limit 5
	`)
	if err == nil {
		defer modelRows.Close()
		for modelRows.Next() {
			var model string
			var provider string
			var requests int
			var tokens int
			if err := modelRows.Scan(&model, &provider, &requests, &tokens); err == nil {
				topModels = append(topModels, AnalyticsTopModel{
					Model:    model,
					Provider: provider,
					Requests: requests,
					Tokens:   tokens,
				})
			}
		}
	}

	return AnalyticsSummary{
		Success:   true,
		Totals:    totals,
		PerDay:    perDay,
		TopModels: topModels,
	}
}

func getAnalyticsRecent(limit int) AnalyticsRecent {
	db, err := getAnalyticsDB()
	if err != nil {
		return AnalyticsRecent{Success: false, Error: err.Error()}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := db.QueryContext(ctx, `
		select ts, model, provider, total_tokens, latency_ms, success, error
		from request_logs
		order by id desc
		limit ?
	`, limit)
	if err != nil {
		return AnalyticsRecent{Success: false, Error: err.Error()}
	}
	defer rows.Close()

	entries := []AnalyticsRecentEntry{}
	for rows.Next() {
		var ts string
		var model string
		var provider string
		var totalTokens int
		var latencyMs int64
		var success int
		var errMsg sql.NullString
		if err := rows.Scan(&ts, &model, &provider, &totalTokens, &latencyMs, &success, &errMsg); err == nil {
			entry := AnalyticsRecentEntry{
				Timestamp:   ts,
				Model:       model,
				Provider:    provider,
				TotalTokens: totalTokens,
				LatencyMs:   latencyMs,
				Success:     success == 1,
				Error:       errMsg.String,
			}
			entries = append(entries, entry)
		}
	}

	return AnalyticsRecent{Success: true, Entries: entries}
}

func getModelUsage(days int, hours int, accountID string) ([]ModelUsageEntry, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	now := time.Now()
	if hours > 0 {
		since := now.Add(-time.Duration(hours) * time.Hour).Format(time.RFC3339)
		return queryModelUsage(ctx, since, accountID)
	}
	if days <= 0 {
		days = 7
	}
	since := now.AddDate(0, 0, -days).Format(time.RFC3339)
	return queryModelUsage(ctx, since, accountID)
}

func queryModelUsage(ctx context.Context, since string, accountID string) ([]ModelUsageEntry, error) {
	db, err := getAnalyticsDB()
	if err != nil {
		return nil, err
	}
	query := `
		select model, provider, count(*),
		       coalesce(sum(prompt_tokens), 0),
		       coalesce(sum(completion_tokens), 0),
		       coalesce(sum(total_tokens), 0),
		       max(ts)
		from request_logs
		where ts >= ? and model != ''`
	args := []interface{}{since}
	if accountID != "" {
		query += " and account_id = ?"
		args = append(args, accountID)
	}
	query += `
		group by model, provider
		order by provider asc, sum(total_tokens) desc`
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := []ModelUsageEntry{}
	for rows.Next() {
		var model string
		var provider string
		var requests int
		var promptTokens int
		var completionTokens int
		var totalTokens int
		var lastUsed string
		if err := rows.Scan(&model, &provider, &requests, &promptTokens, &completionTokens, &totalTokens, &lastUsed); err == nil {
			entries = append(entries, ModelUsageEntry{
				Model:            model,
				Provider:         provider,
				Requests:         requests,
				PromptTokens:     promptTokens,
				CompletionTokens: completionTokens,
				TotalTokens:      totalTokens,
				LastUsed:         lastUsed,
			})
		}
	}
	return entries, nil
}

func getAccountModelUsage(days int, hours int) ([]AccountModelUsageEntry, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	now := time.Now()
	if hours > 0 {
		since := now.Add(-time.Duration(hours) * time.Hour).Format(time.RFC3339)
		return queryAccountModelUsage(ctx, since)
	}
	if days <= 0 {
		days = 7
	}
	since := now.AddDate(0, 0, -days).Format(time.RFC3339)
	return queryAccountModelUsage(ctx, since)
}

func queryAccountModelUsage(ctx context.Context, since string) ([]AccountModelUsageEntry, error) {
	db, err := getAnalyticsDB()
	if err != nil {
		return nil, err
	}
	query := `
		select account_id, model, provider, count(*),
		       coalesce(sum(prompt_tokens), 0),
		       coalesce(sum(completion_tokens), 0),
		       coalesce(sum(total_tokens), 0),
		       max(ts)
		from request_logs
		where ts >= ? and model != '' and account_id != ''
		group by account_id, model, provider
		order by account_id asc, sum(total_tokens) desc`
	rows, err := db.QueryContext(ctx, query, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := []AccountModelUsageEntry{}
	for rows.Next() {
		var accountID string
		var model string
		var provider string
		var requests int
		var promptTokens int
		var completionTokens int
		var totalTokens int
		var lastUsed string
		if err := rows.Scan(
			&accountID,
			&model,
			&provider,
			&requests,
			&promptTokens,
			&completionTokens,
			&totalTokens,
			&lastUsed,
		); err == nil {
			entries = append(entries, AccountModelUsageEntry{
				AccountID:        accountID,
				Model:            model,
				Provider:         provider,
				Requests:         requests,
				PromptTokens:     promptTokens,
				CompletionTokens: completionTokens,
				TotalTokens:      totalTokens,
				LastUsed:         lastUsed,
			})
		}
	}
	return entries, nil
}
