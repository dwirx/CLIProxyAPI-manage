# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

betaCLIProxyAPI is a Go-based CLI tool that manages the CLIProxyAPIPlus server—a proxy that enables access to multiple AI providers (Gemini, Claude, Copilot, etc.) through a unified OpenAI-compatible API. The tool handles installation, OAuth authentication, server lifecycle, and provides a React-based web GUI for management, analytics, and multi-account OAuth token management.

## Build Commands

### Go CLI
```bash
# Development build
go build -o betacliproxyapi ./cmd/betacliproxyapi

# With version info
go build -ldflags "-X main.version=$(git describe --tags)" -o betacliproxyapi ./cmd/betacliproxyapi

# Cross-platform builds (outputs to dist/)
./scripts/build.sh        # macOS/Linux
./scripts/build.ps1       # Windows PowerShell

# Run tests
go test ./...
```

### React GUI
```bash
cd gui
npm install              # Install dependencies
npm run dev             # Start Vite dev server
npm run build           # Build production assets → cmd/betacliproxyapi/gui/dist
```

The GUI assets are embedded into the Go binary via `//go:embed` directive in `gui.go:21`.

## Architecture

### High-Level Structure

**CLI Entry Point (`cmd/betacliproxyapi/main.go`)**
- Simple command router: maps subcommands (`install`, `start`, `oauth`, `gui`, etc.) to handler functions
- Each subcommand has its own file (e.g., `install.go`, `server.go`, `oauth.go`)

**Server Management**
- **install.go**: Downloads CLIProxyAPIPlus binary from GitHub releases, creates config directory, generates `config.yaml` and Factory Droid config
- **server.go**: Manages CLIProxyAPIPlus lifecycle (start/stop/restart/status) via OS process control
- **update.go**: Checks GitHub API for new releases and updates the CLIProxyAPIPlus binary
- **release.go**: GitHub API client for fetching release information

**OAuth & Account Management**
- **oauth.go**: CLI-based interactive OAuth flow helper for multiple providers
- **oauth_session.go**: Web-based OAuth session management—spawns OAuth subprocess, captures output via HTTP streaming
- **accounts.go**: Multi-account token file management (list, delete, set current, enable/disable)
- Tokens stored as `{provider}-{hash}.json` in `~/.cli-proxy-api/` (e.g., `gemini-a1b2c3.json`)
- "Current" account determined by most recent file modification time (touch to update)

**Analytics & Pricing**
- **analytics.go**: SQLite-backed request logging (model, provider, tokens, latency, success/error)
- **analytics_driver_modernc.go** / **analytics_driver_sqlite3.go**: Build-tag-based SQLite driver selection (default: pure-Go modernc)
- Database: `~/.cli-proxy-api/dataproxy.db` (auto-created on first request)
- **pricing**: Fetches model pricing from `llm-prices.com/current-v1.json`, calculates costs based on usage

**Quota Management**
- **quota.go**: Per-model token limit configuration stored in `~/.cli-proxy-api/quota.json`
- Used by GUI to display warnings when approaching limits

**GUI Web Server (`gui.go`)**
- Embedded React SPA served on port 8318 (default)
- HTTP handlers at `/api/*` provide:
  - Server control (start/stop/restart)
  - OAuth session management (start/poll)
  - Account CRUD operations
  - Analytics data (summary, recent requests, model usage, account-level usage)
  - Pricing data and quota rules
  - Playground (test prompts against models)
  - Config/factory management
- React frontend communicates via these REST endpoints

**Configuration Management**
- **paths.go**: Centralized path resolution with environment variable overrides (`CLIPROXY_CONFIG_DIR`, `CLIPROXY_BIN_DIR`, `CLIPROXY_FACTORY_DIR`)
- **factory.go**: Manages Factory Droid `config.json` (provider configurations)
- **types.go**: Shared type definitions (config structs, server info, etc.)
- **utils.go**: Common helpers (file operations, JSON I/O, error printing with colors)

### React GUI Architecture

**State Management**
- Zustand store (`gui/src/store/useAppStore.ts`) manages global state (server status, providers, models)

**Key Components**
- **ProvidersGrid.tsx**: OAuth provider cards with login/status display
- **AccountsTable.tsx**: Multi-account token management (delete, set current, disable/enable)
- **UsageAnalytics.tsx** / **PricingAnalyzer.tsx**: Charts and cost analysis using Recharts
- **Playground.tsx**: Interactive model testing with Markdown preview
- **QuotaLimits.tsx**: Per-model token limit configuration
- **AntigravityOverview.tsx**: Special provider-specific UI for Antigravity
- **CliIntegrations.tsx**: Setup instructions for Claude Code environment variables

**Routing**
- React Router (`gui/src/routes/`) defines SPA navigation
- Layout component (`gui/src/components/Layout.tsx`) provides sidebar navigation

**Styling**
- Tailwind CSS + DaisyUI for component styling
- Framer Motion for animations

## Important Patterns & Conventions

### OAuth Token File Naming
Token files follow `{provider}-{hash}.json` pattern. The hash is derived from account email or unique identifier. Disabled accounts have `.disabled` suffix (e.g., `gemini-a1b2c3.json.disabled`).

### "Current" Account Selection
Each provider uses the token file with the most recent modification time. The GUI's "Set Current" action uses `os.Chtimes()` to touch the file, making it the newest.

### SQLite Driver Selection
By default, uses pure-Go `modernc.org/sqlite`. To use CGO-based `mattn/go-sqlite3`, build with:
```bash
go build -tags sqlite3 ./cmd/betacliproxyapi
```

### Embedded Assets
GUI assets are embedded at compile time via `//go:embed gui/dist/* gui/dist/assets/* gui/legacy.html` in `gui.go`. Always rebuild the Go binary after `npm run build` to pick up frontend changes.

### Configuration Paths
Default config directory: `~/.cli-proxy-api` (override with `CLIPROXY_CONFIG_DIR`)
- `config.yaml`: Main server config
- `dataproxy.db`: Analytics database
- `quota.json`: Quota limits
- `{provider}-*.json`: OAuth tokens

Factory Droid config: `~/.factory/config.json` (override with `CLIPROXY_FACTORY_DIR`)

### Error Handling & User Feedback
Use utility functions from `utils.go`:
- `printSuccess()`, `printError()`, `printWarning()` for colored CLI output
- `writeJSON()` for HTTP responses
- Always return HTTP 200 with `{"success": false, "error": "..."}` for application-level errors

## Development Workflow

### Adding a New OAuth Provider
1. Add provider to `accountPatterns` map in `accounts.go`
2. Add flag to `oauth.go` command parsing
3. Update `oauthFlag()` function in `oauth_session.go`
4. Add provider card to `ProvidersGrid.tsx` in GUI
5. Update `handleOAuthSession()` in `gui.go` if provider needs special handling

### Adding a New Analytics Metric
1. Extend `RequestLog` struct in `analytics.go`
2. Update database schema in `initAnalyticsDB()`
3. Add query/aggregation logic for new metric
4. Create HTTP handler in `gui.go` to expose data
5. Update React components to consume new endpoint

### Modifying GUI
1. Make changes in `gui/src/`
2. Test with `npm run dev` (points to mock API or real server)
3. Run `npm run build` to generate production assets
4. Rebuild Go binary to embed new assets: `go build -o betacliproxyapi ./cmd/betacliproxyapi`

## Testing Notes

Currently no `*_test.go` files exist. When adding tests:
- Place test files co-located with source (e.g., `analytics_test.go` next to `analytics.go`)
- Run with `go test ./...`
- For GUI changes, manually verify functionality in browser

## Claude Code Integration

This tool is designed to work with Claude Code by proxying requests through CLIProxyAPIPlus. Configuration pattern:
```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:8317"
export ANTHROPIC_AUTH_TOKEN="sk-dummy"
export ANTHROPIC_DEFAULT_SONNET_MODEL="gemini-2.5-flash"  # or other model
```

See README.md lines 279-375 for complete setup instructions per provider.

## Code Style

- Go: Follow `gofmt` (tabs, standard layout). Run `gofmt -w` on modified files.
- React/TypeScript: PascalCase for components, camelCase for utilities/hooks
- Tailwind: Group classes by layout → spacing → color for readability
- Commit messages: Imperative mood, short summaries (e.g., "Add analytics", "Fix OAuth flow")
