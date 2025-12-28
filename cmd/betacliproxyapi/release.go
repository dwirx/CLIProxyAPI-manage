package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

type releaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

type releaseInfo struct {
	TagName     string         `json:"tag_name"`
	PublishedAt string         `json:"published_at"`
	Name        string         `json:"name"`
	Assets      []releaseAsset `json:"assets"`
}

func fetchLatestRelease(repo string) (*releaseInfo, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", repo)
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "betaCLIProxyAPI")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("release request failed: %s", resp.Status)
	}
	var release releaseInfo
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, err
	}
	return &release, nil
}

func selectReleaseAsset(assets []releaseAsset) (*releaseAsset, error) {
	osTokens := map[string][]string{
		"windows": {"windows", "win"},
		"linux":   {"linux"},
		"darwin":  {"darwin", "mac", "macos", "osx"},
	}
	archTokens := map[string][]string{
		"amd64": {"amd64", "x86_64"},
		"arm64": {"arm64", "aarch64"},
	}

	osCandidates := osTokens[runtime.GOOS]
	archCandidates := archTokens[runtime.GOARCH]

	matches := func(name string, tokens []string) bool {
		for _, token := range tokens {
			if strings.Contains(name, token) {
				return true
			}
		}
		return false
	}

	for _, asset := range assets {
		name := strings.ToLower(asset.Name)
		if strings.HasSuffix(name, ".zip") && matches(name, osCandidates) && matches(name, archCandidates) {
			return &asset, nil
		}
	}

	for _, asset := range assets {
		name := strings.ToLower(asset.Name)
		if strings.HasSuffix(name, ".zip") {
			return &asset, nil
		}
	}

	return nil, fmt.Errorf("no suitable release asset found")
}

func downloadFile(url, dest string) error {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("download failed: %s", resp.Status)
	}
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, resp.Body)
	return err
}

func extractZip(zipPath, dest string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		cleanName := filepath.Clean(f.Name)
		if strings.HasPrefix(cleanName, "..") {
			continue
		}
		targetPath := filepath.Join(dest, cleanName)
		if f.FileInfo().IsDir() {
			if err := ensureDir(targetPath); err != nil {
				return err
			}
			continue
		}

		if err := ensureDir(filepath.Dir(targetPath)); err != nil {
			return err
		}

		in, err := f.Open()
		if err != nil {
			return err
		}

		out, err := os.Create(targetPath)
		if err != nil {
			_ = in.Close()
			return err
		}

		if _, err := io.Copy(out, in); err != nil {
			_ = out.Close()
			_ = in.Close()
			return err
		}
		_ = out.Close()
		_ = in.Close()
	}

	return nil
}

func findBinaryInDir(root string) (string, error) {
	preferred := strings.ToLower(binaryName())
	var candidate string
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		name := strings.ToLower(d.Name())
		if name == preferred {
			candidate = path
			return filepath.SkipDir
		}
		if strings.Contains(name, "cliproxyapi") || strings.Contains(name, "cli-proxy-api") {
			if candidate == "" {
				candidate = path
			}
		}
		return nil
	})
	if candidate == "" {
		return "", fmt.Errorf("binary not found in archive")
	}
	return candidate, nil
}
