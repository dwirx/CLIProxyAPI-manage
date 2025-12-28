package main

import (
	"flag"
	"fmt"
	"os"
)

type updateOptions struct {
	Force  bool
	Source bool
}

func runUpdate(args []string) {
	fs := flag.NewFlagSet("update", flag.ExitOnError)
	force := fs.Bool("force", false, "overwrite existing binary")
	source := fs.Bool("source", false, "build from source instead of downloading")
	_ = fs.Parse(args)

	opts := updateOptions{
		Force:  *force,
		Source: *source,
	}

	if err := update(opts); err != nil {
		printError(err.Error())
		os.Exit(1)
	}
}

func update(opts updateOptions) error {
	printStep(fmt.Sprintf("Detected platform: %s (%s)", platformLabel(), archLabel()))
	if !fileExists(binaryPath()) {
		return fmt.Errorf("binary not found, run install first")
	}

	if opts.Source {
		printStep("Building latest CLIProxyAPIPlus from source...")
		if err := buildFromSource(true); err != nil {
			return err
		}
		if err := writeVersionInfo("source", ""); err != nil {
			printWarning(fmt.Sprintf("Failed to update version info: %v", err))
		}
		printSuccess("Update complete (source)")
		return nil
	}

	printStep("Downloading latest CLIProxyAPIPlus release...")
	if err := backupBinary(); err != nil {
		printWarning(fmt.Sprintf("Failed to backup existing binary: %v", err))
	}

	versionTag, versionDate, err := downloadAndInstallBinary(true)
	if err != nil {
		return err
	}
	if err := writeVersionInfo(versionTag, versionDate); err != nil {
		printWarning(fmt.Sprintf("Failed to update version info: %v", err))
	}

	printSuccess("Update complete")
	fmt.Printf("Binary: %s\n", binaryPath())
	return nil
}

func backupBinary() error {
	if !fileExists(binaryPath()) {
		return nil
	}
	backupPath := binaryPath() + ".old"
	return copyFile(binaryPath(), backupPath, defaultFileMode())
}
