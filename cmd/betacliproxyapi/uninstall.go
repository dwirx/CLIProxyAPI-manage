package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

type uninstallOptions struct {
	All       bool
	KeepAuth  bool
	KeepDroid bool
	Force     bool
}

func runUninstall(args []string) {
	fs := flag.NewFlagSet("uninstall", flag.ExitOnError)
	all := fs.Bool("all", false, "remove all files including auth")
	keepAuth := fs.Bool("keep-auth", false, "keep OAuth tokens")
	keepDroid := fs.Bool("keep-droid-config", false, "keep Droid config entries")
	force := fs.Bool("force", false, "skip confirmation")
	_ = fs.Parse(args)

	opts := uninstallOptions{
		All:       *all,
		KeepAuth:  *keepAuth,
		KeepDroid: *keepDroid,
		Force:     *force,
	}

	if err := uninstall(opts); err != nil {
		printError(err.Error())
		os.Exit(1)
	}
}

func uninstall(opts uninstallOptions) error {
	if !opts.Force {
		if !confirmPrompt("Are you sure you want to uninstall?") {
			printWarning("Uninstall cancelled")
			return nil
		}
	}

	itemsRemoved := 0
	removeAuth := opts.All && !opts.KeepAuth
	removeDroid := opts.All && !opts.KeepDroid

	itemsRemoved += removeFile(binaryPath())
	itemsRemoved += removeFile(binaryPath() + ".old")

	cloneDir := filepath.Join(homeDir(), "CLIProxyAPIPlus")
	itemsRemoved += removeDir(cloneDir)

	if removeAuth {
		itemsRemoved += removeDir(configDir())
	} else {
		itemsRemoved += removeFile(configPath())
		itemsRemoved += removeDir(logsDir())
		matches, _ := filepath.Glob(filepath.Join(configDir(), "*.json"))
		if len(matches) > 0 {
			printWarning("Auth files preserved (use --all to remove)")
		}
	}

	if removeDroid {
		if err := clearFactoryConfig(); err != nil {
			printWarning(fmt.Sprintf("Failed to clear Droid config: %v", err))
		}
	} else if opts.All {
		printWarning("Droid config preserved (use --all without --keep-droid-config to clear)")
	}

	printSuccess("Uninstall complete")
	fmt.Printf("Removed %d items\n", itemsRemoved)
	return nil
}

func removeFile(path string) int {
	if fileExists(path) {
		if err := os.Remove(path); err == nil {
			printSuccess(fmt.Sprintf("Removed %s", path))
			return 1
		}
	}
	return 0
}

func removeDir(path string) int {
	if dirExists(path) {
		if err := os.RemoveAll(path); err == nil {
			printSuccess(fmt.Sprintf("Removed %s", path))
			return 1
		}
	}
	return 0
}
