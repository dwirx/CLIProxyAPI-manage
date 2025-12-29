package main

import (
	"context"
	"database/sql"
	"math"
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
		analyticsDB = db
	})
	return analyticsDB, analyticsErr
}

func logRequest(entry RequestLog) {
	db, err := getAnalyticsDB()
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_, _ = db.ExecContext(ctx, `
		insert into request_logs (ts, source, model, provider, prompt_tokens, completion_tokens, total_tokens, latency_ms, success, error)
		values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		entry.Timestamp.Format(time.RFC3339),
		entry.Source,
		entry.Model,
		entry.Provider,
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
