# betaCLIProxyAPI

Go-based replacement for the PowerShell scripts in `CLIProxyAPIPlus-Easy-Installation`.

This tool manages installation, updates, and local control for **CLIProxyAPIPlus**:
- Download/build the latest server binary
- Create `~/.cli-proxy-api/config.yaml`
- Manage Factory Droid `~/.factory/config.json`
- OAuth helper for providers
- Local GUI control center

## Build

```
go build -o betacliproxyapi ./cmd/betacliproxyapi
```

### Cross-compile (Windows/Linux/macOS)

```
# macOS/Linux
./scripts/build.sh

# Windows (PowerShell)
./scripts/build.ps1
```

Outputs are written to `dist/`.

## Usage

```
# Install CLIProxyAPIPlus (download latest release)
betacliproxyapi install

# Start server (background)
betacliproxyapi start --background

# OAuth login helper
betacliproxyapi oauth --all

# Control Center GUI
betacliproxyapi gui

# Update server binary
betacliproxyapi update
```

## Environment Overrides

```
CLIPROXY_CONFIG_DIR  # default: ~/.cli-proxy-api
CLIPROXY_BIN_DIR     # default: ~/bin
CLIPROXY_FACTORY_DIR # default: ~/.factory
```
