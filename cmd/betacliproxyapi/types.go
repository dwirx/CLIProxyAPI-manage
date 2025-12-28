package main

type ServerStatus struct {
	Running   bool    `json:"running"`
	PID       int     `json:"pid,omitempty"`
	Memory    float64 `json:"memory,omitempty"`
	StartTime string  `json:"startTime,omitempty"`
	Port      int     `json:"port"`
	Endpoint  string  `json:"endpoint"`
}

type VersionInfo struct {
	Scripts    string `json:"scripts"`
	CommitSha  string `json:"commitSha"`
	CommitDate string `json:"commitDate"`
	LastCheck  string `json:"lastCheck"`
}

type UpdateInfo struct {
	CurrentVersion      string `json:"currentVersion"`
	CurrentCommit       string `json:"currentCommit"`
	LatestCommit        string `json:"latestCommit"`
	LatestCommitDate    string `json:"latestCommitDate"`
	LatestCommitMessage string `json:"latestCommitMessage"`
	HasUpdate           bool   `json:"hasUpdate"`
	DownloadURL         string `json:"downloadUrl"`
	RepoURL             string `json:"repoUrl"`
	Error               string `json:"error,omitempty"`
}
