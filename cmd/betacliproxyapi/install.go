package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	cliProxyRepo    = "router-for-me/CLIProxyAPIPlus"
	cliProxyRepoURL = "https://github.com/router-for-me/CLIProxyAPIPlus.git"
)

type installOptions struct {
	UsePrebuilt bool
	Force       bool
	SkipOAuth   bool
	Source      bool
}

func runInstall(args []string) {
	fs := flag.NewFlagSet("install", flag.ExitOnError)
	force := fs.Bool("force", false, "overwrite existing files")
	skipOAuth := fs.Bool("skip-oauth", false, "skip OAuth instructions")
	source := fs.Bool("source", false, "build from source instead of downloading")
	_ = fs.Parse(args)

	opts := installOptions{
		UsePrebuilt: !*source,
		Force:       *force,
		SkipOAuth:   *skipOAuth,
		Source:      *source,
	}

	if err := install(opts); err != nil {
		printError(err.Error())
		os.Exit(1)
	}
}

func install(opts installOptions) error {
	printStep(fmt.Sprintf("Detected platform: %s (%s)", platformLabel(), archLabel()))
	printStep("Preparing directories...")
	if err := ensureDir(binDir()); err != nil {
		return err
	}
	if err := ensureDir(configDir()); err != nil {
		return err
	}
	if err := ensureDir(factoryDir()); err != nil {
		return err
	}
	printSuccess("Directories ready")

	var versionTag string
	var versionDate string

	if opts.UsePrebuilt {
		printStep("Downloading prebuilt CLIProxyAPIPlus binary...")
		var err error
		versionTag, versionDate, err = downloadAndInstallBinary(opts.Force)
		if err != nil {
			return err
		}
		printSuccess("Binary installed")
	} else {
		printStep("Building CLIProxyAPIPlus from source...")
		if err := buildFromSource(opts.Force); err != nil {
			return err
		}
		versionTag = "source"
		versionDate = ""
		printSuccess("Binary built from source")
	}

	printStep("Configuring config.yaml...")
	if err := writeDefaultConfig(opts.Force); err != nil {
		return err
	}
	printSuccess("Config ready")

	printStep("Updating Droid config...")
	if err := writeFactoryConfig(defaultFactoryConfig()); err != nil {
		return err
	}
	printSuccess("Droid config updated")

	if err := writeVersionInfo(versionTag, versionDate); err != nil {
		printWarning(fmt.Sprintf("Failed to write version info: %v", err))
	}

	printStep("Verifying installation...")
	if !fileExists(binaryPath()) {
		return fmt.Errorf("binary not found at %s", binaryPath())
	}
	printSuccess("Binary verification passed")

	fmt.Println("")
	fmt.Println("==============================================")
	fmt.Println("  Installation Complete")
	fmt.Println("==============================================")
	fmt.Printf("Binary:  %s\n", binaryPath())
	fmt.Printf("Config:  %s\n", configPath())
	fmt.Printf("Droid:   %s\n", factoryConfigPath())
	fmt.Println("")
	fmt.Println("Quick Start:")
	fmt.Println("  1. Start server:    betacliproxyapi start --background")
	fmt.Println("  2. Login OAuth:     betacliproxyapi oauth --all")
	fmt.Println("  3. Open GUI:        betacliproxyapi gui")
	fmt.Println("")
	fmt.Println("Make sure your bin directory is in PATH:")
	fmt.Printf("  %s\n", binDir())

	if !opts.SkipOAuth {
		printOAuthHints()
	}

	return nil
}

func downloadAndInstallBinary(force bool) (string, string, error) {
	release, err := fetchLatestRelease(cliProxyRepo)
	if err != nil {
		return "", "", err
	}
	asset, err := selectReleaseAsset(release.Assets)
	if err != nil {
		return "", "", err
	}

	tempDir, err := os.MkdirTemp("", "cliproxyapi-download")
	if err != nil {
		return "", "", err
	}
	defer os.RemoveAll(tempDir)

	zipPath := filepath.Join(tempDir, "release.zip")
	if err := downloadFile(asset.BrowserDownloadURL, zipPath); err != nil {
		return "", "", err
	}
	if err := extractZip(zipPath, tempDir); err != nil {
		return "", "", err
	}

	binarySource, err := findBinaryInDir(tempDir)
	if err != nil {
		return "", "", err
	}

	dest := binaryPath()
	if fileExists(dest) && !force {
		printWarning("Binary already exists, use --force to overwrite")
		return release.TagName, release.PublishedAt, nil
	}

	if err := copyFile(binarySource, dest, defaultFileMode()); err != nil {
		return "", "", err
	}

	return release.TagName, release.PublishedAt, nil
}

func buildFromSource(force bool) error {
	if err := requireCommand("git"); err != nil {
		return err
	}
	if err := requireCommand("go"); err != nil {
		return err
	}

	cloneDir := filepath.Join(homeDir(), "CLIProxyAPIPlus")
	if dirExists(cloneDir) {
		if force {
			printWarning("Removing existing source clone")
			if err := os.RemoveAll(cloneDir); err != nil {
				return err
			}
		} else {
			printWarning("Source already cloned, use --force to re-clone")
		}
	}

	if !dirExists(cloneDir) {
		if err := runCommand("git", "clone", "--depth", "1", cliProxyRepoURL, cloneDir); err != nil {
			return err
		}
	}

	cmd := exec.Command("go", "build", "-o", binaryPath(), "./cmd/server")
	cmd.Dir = cloneDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func writeDefaultConfig(force bool) error {
	path := configPath()
	if fileExists(path) && !force {
		printWarning("config.yaml already exists, skipping")
		return nil
	}
	content := defaultConfigYAML(configDir())
	return os.WriteFile(path, []byte(content), 0o644)
}

func printOAuthHints() {
	fmt.Println("")
	fmt.Println("OAuth login commands:")
	fmt.Printf("  %s --config %s --login\n", binaryName(), configPath())
	fmt.Printf("  %s --config %s --antigravity-login\n", binaryName(), configPath())
	fmt.Printf("  %s --config %s --github-copilot-login\n", binaryName(), configPath())
	fmt.Printf("  %s --config %s --codex-login\n", binaryName(), configPath())
	fmt.Printf("  %s --config %s --claude-login\n", binaryName(), configPath())
	fmt.Printf("  %s --config %s --qwen-login\n", binaryName(), configPath())
	fmt.Printf("  %s --config %s --iflow-login\n", binaryName(), configPath())
	fmt.Printf("  %s --config %s --kiro-aws-login\n", binaryName(), configPath())
}

func defaultConfigYAML(configDir string) string {
	path := filepath.ToSlash(configDir)
	lines := []string{
		"port: 8317",
		fmt.Sprintf("auth-dir: \"%s\"", path),
		"api-keys:",
		"  - \"sk-dummy\"",
		"quota-exceeded:",
		"  switch-project: true",
		"  switch-preview-model: true",
		"incognito-browser: true",
		"request-retry: 3",
		"remote-management:",
		"  allow-remote: false",
		"  secret-key: \"\"",
		"  disable-control-panel: false",
		"",
	}
	return strings.Join(lines, "\n")
}

func writeVersionInfo(tag, date string) error {
	info := VersionInfo{
		Scripts:    managerVersion,
		CommitSha:  tag,
		CommitDate: date,
		LastCheck:  "",
	}
	return saveVersionInfo(info)
}
