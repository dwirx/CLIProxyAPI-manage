# Repository Guidelines

## Project Structure & Module Organization
- `cmd/betacliproxyapi/` contains the Go CLI entry point and feature modules (install/update/server/oauth/gui).
- `configs/` holds example configuration templates (`config.yaml.example`, `droid-config.json.example`).
- `scripts/` provides cross-platform build scripts (`build.sh`, `build.ps1`).
- `gui/` is the Vite + React frontend (`gui/src`, `gui/index.html`, `gui/vite.config.ts`).
- `cmd/betacliproxyapi/gui/` is where built GUI assets are embedded (output goes to `cmd/betacliproxyapi/gui/dist`).

## Build, Test, and Development Commands
- `go build -o betacliproxyapi ./cmd/betacliproxyapi` builds the CLI locally.
- `./scripts/build.sh` or `./scripts/build.ps1` builds cross-platform artifacts into `dist/`.
- `go test ./...` runs Go tests (when present).
- `cd gui && npm install` installs frontend dependencies.
- `cd gui && npm run dev` starts the Vite dev server for the GUI.
- `cd gui && npm run build` emits static assets to `cmd/betacliproxyapi/gui/dist`.

## Coding Style & Naming Conventions
- Go code follows `gofmt` formatting (tabs, standard layout). Run `gofmt -w` on touched Go files.
- Go filenames use lowercase with underscores for multiword files (e.g., `oauth_session.go`).
- React components in `gui/src/components` use PascalCase filenames (e.g., `UsageAnalytics.tsx`); hooks/utilities live in `gui/src/lib`.
- Tailwind + DaisyUI are used for styling; keep class lists readable and grouped by layout, spacing, and color.

## Testing Guidelines
- There are currently no `*_test.go` files; add co-located unit tests when introducing new logic.
- Prefer `go test ./...` for backend validation; note any manual GUI checks if you change `gui/src`.

## Commit & Pull Request Guidelines
- Commit messages in history use short, imperative summaries (e.g., `Add analytics...`, `Move GUI directory...`). Follow that pattern.
- PRs should include: a brief summary, test notes (`go test ./...`, `npm run build` if GUI), and screenshots for UI changes.

## Security & Configuration Tips
- Never commit real secrets; use `configs/*.example` as templates.
- Configuration lives under `~/.cli-proxy-api` by default; document any new env vars (e.g., `CLIPROXY_CONFIG_DIR`).
