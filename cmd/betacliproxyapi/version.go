package main

import (
	"encoding/json"
	"os"
	"time"
)

func loadVersionInfo() VersionInfo {
	data, err := os.ReadFile(versionPath())
	if err != nil {
		return VersionInfo{Scripts: managerVersion, CommitSha: "unknown"}
	}
	var info VersionInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return VersionInfo{Scripts: managerVersion, CommitSha: "unknown"}
	}
	if info.Scripts == "" {
		info.Scripts = managerVersion
	}
	if info.CommitSha == "" {
		info.CommitSha = "unknown"
	}
	return info
}

func saveVersionInfo(info VersionInfo) error {
	data, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		return err
	}
	if err := ensureDir(configDir()); err != nil {
		return err
	}
	return os.WriteFile(versionPath(), data, 0o644)
}

func updateLastCheck(info VersionInfo) VersionInfo {
	info.LastCheck = time.Now().Format(time.RFC3339)
	_ = saveVersionInfo(info)
	return info
}
