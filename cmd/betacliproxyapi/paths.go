package main

import (
	"os"
	"path/filepath"
	"runtime"
)

func homeDir() string {
	if env := os.Getenv("HOME"); env != "" {
		return env
	}
	if env := os.Getenv("USERPROFILE"); env != "" {
		return env
	}
	if dir, err := os.UserHomeDir(); err == nil {
		return dir
	}
	return "."
}

func configDir() string {
	if env := os.Getenv("CLIPROXY_CONFIG_DIR"); env != "" {
		return env
	}
	return filepath.Join(homeDir(), ".cli-proxy-api")
}

func binDir() string {
	if env := os.Getenv("CLIPROXY_BIN_DIR"); env != "" {
		return env
	}
	return filepath.Join(homeDir(), "bin")
}

func factoryDir() string {
	if env := os.Getenv("CLIPROXY_FACTORY_DIR"); env != "" {
		return env
	}
	return filepath.Join(homeDir(), ".factory")
}

func configPath() string {
	return filepath.Join(configDir(), "config.yaml")
}

func binaryName() string {
	name := "cliproxyapi-plus"
	if runtime.GOOS == "windows" {
		return name + ".exe"
	}
	return name
}

func binaryPath() string {
	return filepath.Join(binDir(), binaryName())
}

func logsDir() string {
	return filepath.Join(configDir(), "logs")
}

func pidPath() string {
	return filepath.Join(configDir(), "server.pid")
}

func versionPath() string {
	return filepath.Join(configDir(), "version.json")
}

func factoryConfigPath() string {
	return filepath.Join(factoryDir(), "config.json")
}
