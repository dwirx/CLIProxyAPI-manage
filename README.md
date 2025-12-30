# betaCLIProxyAPI

Go-based replacement for the PowerShell scripts in `CLIProxyAPIPlus-Easy-Installation`. A comprehensive CLI tool for managing installation, updates, and local control of **CLIProxyAPIPlus** server.

## Features

- **Easy Installation** - Download and install the latest CLIProxyAPIPlus server binary
- **Update Management** - Update server binary to the latest version
- **Configuration Management** - Automatically create and manage `config.yaml` and Factory Droid config
- **OAuth Helper** - Interactive OAuth login helper for multiple providers (CLI + GUI)
- **Accounts Manager** - Multi-account OAuth tokens with set current + delete
- **GUI Control Center** - Local web-based control panel for server management
- **Server Control** - Start, stop, restart, and monitor server status
- **Analytics** - SQLite-backed usage analytics, pricing, and model usage

## Requirements

- Go 1.21 or higher
- Git (for cloning repository)
- Internet connection (for downloading releases)
- Node.js 18+ (only needed to build the GUI)

## Installation

### From Source

```bash
# Clone the repository
git clone git@github.com:dwirx/CLIProxyAPI-manage.git
cd betaCLIProxyAPI

# Build the binary
go build -o betacliproxyapi ./cmd/betacliproxyapi

# Install to system PATH (optional)
sudo mv betacliproxyapi /usr/local/bin/
```

### Cross-Compilation

Build for multiple platforms:

```bash
# macOS/Linux
./scripts/build.sh

# Windows (PowerShell)
./scripts/build.ps1
```

Build outputs are written to `dist/` directory.

## Quick Start

### 1. Install CLIProxyAPIPlus

```bash
betacliproxyapi install
```

This command will:
- Download the latest CLIProxyAPIPlus server binary
- Create configuration directory (`~/.cli-proxy-api`)
- Generate `config.yaml` from example template
- Set up Factory Droid configuration if needed

### 2. Configure OAuth Providers

```bash
# Interactive OAuth setup for all providers
betacliproxyapi oauth --all

# Or setup specific provider
betacliproxyapi oauth --gemini
```

### 3. Start the Server

```bash
# Start in foreground
betacliproxyapi start

# Start in background
betacliproxyapi start --background
```

### 4. Access Control Center

```bash
betacliproxyapi gui
```

Opens a local web interface (default: http://localhost:8318) for managing the server.

### 5. Build React GUI (optional)

The GUI source now lives in `betaCLIProxyAPI/gui` and is built with Vite + React.
Build assets will be emitted into `betaCLIProxyAPI/cmd/betacliproxyapi/gui/dist` and
embedded by the Go server.

```bash
cd betaCLIProxyAPI/gui
npm install
npm run build
```

## GUI Highlights

### Dashboard

The dashboard provides a realtime view of:
- Total requests, tokens, RPM, TPM, and estimated cost
- Request trends and cost breakdown
- Rate limit overview and system health

### Accounts (Multi-Account OAuth)

The Accounts page lets you:
- Add new OAuth logins from the GUI
- Manage multiple accounts per provider
- Set the "current" account (most recently used token file)
- Delete old or unused token files
- Filter by provider and apply bulk actions

**How "Current" works**
- Each provider uses the most recently updated token file.
- "Set current" touches the selected token file(s) to make them most recent.

### Playground

- Run prompts against any model
- Live Markdown preview (toggle Raw/Preview)
- Copy response with visual feedback

### Analytics & Pricing

- Usage logs stored in `~/.cli-proxy-api/dataproxy.db`
- Pricing data pulled from `https://www.llm-prices.com/current-v1.json`
- Model usage derived from real request logs (last 7 days by default)

## Commands

### `install`

Install CLIProxyAPIPlus and create initial configuration.

```bash
betacliproxyapi install [--force] [--skip-oauth] [--source]
```

Options:
- `--force` - Force reinstall even if already installed
- `--skip-oauth` - Skip OAuth hints after install
- `--source` - Build CLIProxyAPIPlus from source instead of downloading

### `update`

Update CLIProxyAPIPlus binary to the latest version.

```bash
betacliproxyapi update [--force] [--source]
```

Options:
- `--force` - Overwrite existing binary
- `--source` - Build from source instead of downloading

### `start`

Start the CLIProxyAPIPlus server.

```bash
betacliproxyapi start [--background] [--config PATH] [--bin PATH]
```

Options:
- `--background` - Run server in background (daemon mode)
- `--config` - Override config.yaml path
- `--bin` - Override CLIProxyAPIPlus binary path

### `stop`

Stop the running CLIProxyAPIPlus server.

```bash
betacliproxyapi stop
```

### `restart`

Restart the CLIProxyAPIPlus server.

```bash
betacliproxyapi restart
```

### `status`

Show server status and information.

```bash
betacliproxyapi status
```

### `logs`

View server logs.

```bash
betacliproxyapi logs [--tail N]
```

Options:
- `--tail` - Number of lines to show (default: 80)

### `oauth`

Run OAuth login helper for authentication providers.

```bash
betacliproxyapi oauth [--all] [--gemini] [--antigravity] [--copilot] [--codex] [--claude] [--qwen] [--iflow] [--kiro]
```

Options:
- `--all` - Setup OAuth for all supported providers
- `--gemini` - Setup OAuth for Gemini
- `--antigravity` - Setup OAuth for Antigravity
- `--copilot` - Setup OAuth for GitHub Copilot
- `--codex` - Setup OAuth for Codex
- `--claude` - Setup OAuth for Claude
- `--qwen` - Setup OAuth for Qwen
- `--iflow` - Setup OAuth for iFlow
- `--kiro` - Setup OAuth for Kiro (AWS)

### `gui`

Start the Control Center GUI.

```bash
betacliproxyapi gui [--port PORT] [--no-browser]
```

Options:
- `--port` - GUI server port (default: 8318)
- `--no-browser` - Do not open browser automatically

### `uninstall`

Remove CLIProxyAPIPlus installation and configuration files.

```bash
betacliproxyapi uninstall [--keep-config]
```

Options:
- `--keep-config` - Keep configuration files when uninstalling

### `help`

Show help information.

```bash
betacliproxyapi help
betacliproxyapi <command> -h
```

## Configuration

### Environment Variables

You can override default paths using environment variables:

```bash
export CLIPROXY_CONFIG_DIR="$HOME/.custom-cli-proxy-api"  # Config directory
export CLIPROXY_BIN_DIR="$HOME/.local/bin"                # Binary directory
export CLIPROXY_FACTORY_DIR="$HOME/.custom-factory"       # Factory Droid directory
```

### Configuration Files

#### `~/.cli-proxy-api/config.yaml`

Main server configuration file. See `configs/config.yaml.example` for reference.

Key settings:
- `port` - Server port (default: 8317)
- `api-keys` - API keys for authentication
- `quota-exceeded` - Auto-switch behavior when quota exceeded
- `remote-management` - Remote access settings

#### `~/.cli-proxy-api/dataproxy.db`

Analytics database used by the GUI:
- Auto-created on first request
- Stores request logs and model usage
- Used for model quota and usage charts

#### `~/.factory/config.json`

Factory Droid configuration. See `configs/droid-config.json.example` for reference.

## Directory Structure

```
betaCLIProxyAPI/
- cmd/                      # Main application code
  - betacliproxyapi/
    - main.go               # Entry point
    - install.go            # Installation logic
    - update.go             # Update logic
    - server.go             # Server control
    - oauth.go              # OAuth helper
    - gui.go                # GUI server
    - ...
- configs/                  # Configuration examples
  - config.yaml.example
  - droid-config.json.example
- scripts/                  # Build scripts
  - build.sh
  - build.ps1
- go.mod                    # Go module definition
- README.md                 # This file
```

## Default Paths

| Platform | Config Directory | Binary Directory | Factory Directory |
|----------|-----------------|------------------|-------------------|
| Linux/macOS | `~/.cli-proxy-api` | `~/bin` | `~/.factory` |
| Windows | `%USERPROFILE%\.cli-proxy-api` | `%USERPROFILE%\bin` | `%USERPROFILE%\.factory` |

## Development

### Building

```bash
# Development build
go build -o betacliproxyapi ./cmd/betacliproxyapi

# With version info
go build -ldflags "-X main.version=$(git describe --tags)" -o betacliproxyapi ./cmd/betacliproxyapi
```

### Running Tests

```bash
go test ./...
```

### SQLite Driver Notes

Analytics use the pure-Go SQLite driver by default (modernc). If you want to use
`mattn/go-sqlite3`, build with:

```bash
go build -tags sqlite3 ./cmd/betacliproxyapi
```

### Code Structure

- `main.go` - CLI command routing and usage
- `paths.go` - Path management and environment variable handling
- `install.go` - Installation and initial setup
- `update.go` - Update checking and downloading
- `server.go` - Server lifecycle management (start/stop/restart)
- `oauth.go` - OAuth authentication flow
- `gui.go` - Web-based control center
- `factory.go` - Factory Droid configuration management
- `release.go` - GitHub release API interaction
- `platform.go` - Platform-specific utilities
- `utils.go` - Common utility functions
- `types.go` - Type definitions
- `version.go` - Version information management

## Troubleshooting

### Server won't start

1. Check if port 8317 is already in use:
   ```bash
   lsof -i :8317  # Linux/macOS
   netstat -ano | findstr :8317  # Windows
   ```

2. Check server logs:
   ```bash
   betacliproxyapi logs
   ```

3. Verify configuration:
   ```bash
   cat ~/.cli-proxy-api/config.yaml
   ```

### OAuth login fails

1. Ensure browser can access localhost
2. Check if incognito mode is required (set in config.yaml)
3. Verify OAuth tokens directory permissions

### Update fails

1. Check internet connection
2. Verify GitHub API access
3. Check disk space in binary directory

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[Add your license here]

## Related Projects

- [CLIProxyAPIPlus](https://github.com/dwirx/CLIProxyAPIPlus) - The server this tool manages
- [CLIProxyAPIPlus-Easy-Installation](https://github.com/dwirx/CLIProxyAPIPlus-Easy-Installation) - Original PowerShell installation scripts

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review configuration examples in `configs/` directory

---

**Version:** 0.1.0  
**Author:** dwirx
