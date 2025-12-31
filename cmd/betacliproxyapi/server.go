package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type startOptions struct {
	Background bool
	ConfigPath string
	BinaryPath string
}

func runStart(args []string) {
	fs := flag.NewFlagSet("start", flag.ExitOnError)
	background := fs.Bool("background", false, "run server in background")
	config := fs.String("config", "", "path to config.yaml")
	binary := fs.String("bin", "", "path to CLIProxyAPIPlus binary")
	_ = fs.Parse(args)

	opts := startOptions{
		Background: *background,
		ConfigPath: *config,
		BinaryPath: *binary,
	}

	if err := startServer(opts); err != nil {
		printError(err.Error())
		os.Exit(1)
	}
}

func runStop(args []string) {
	fs := flag.NewFlagSet("stop", flag.ExitOnError)
	_ = fs.Parse(args)

	if err := stopServer(); err != nil {
		printError(err.Error())
		os.Exit(1)
	}
}

func runRestart(args []string) {
	fs := flag.NewFlagSet("restart", flag.ExitOnError)
	_ = fs.Parse(args)

	_ = stopServer()
	if err := startServer(startOptions{Background: true}); err != nil {
		printError(err.Error())
		os.Exit(1)
	}
}

func runStatus(args []string) {
	fs := flag.NewFlagSet("status", flag.ExitOnError)
	_ = fs.Parse(args)

	status := getServerStatus()
	fmt.Println("=== CLIProxyAPIPlus Status ===")
	if status.Running {
		printSuccess("Server is RUNNING")
		if status.PID != 0 {
			fmt.Printf("PID: %d\n", status.PID)
		}
		fmt.Printf("Endpoint: %s\n", status.Endpoint)
	} else {
		printWarning("Server is NOT running")
	}
}

func runLogs(args []string) {
	fs := flag.NewFlagSet("logs", flag.ExitOnError)
	tail := fs.Int("tail", 80, "number of lines to show")
	_ = fs.Parse(args)

	stdoutPath := logsDir() + string(os.PathSeparator) + "server-stdout.log"
	stderrPath := logsDir() + string(os.PathSeparator) + "server-stderr.log"

	printStep("Showing stdout log")
	if lines, err := tailLines(stdoutPath, *tail); err == nil {
		for _, line := range lines {
			fmt.Println(line)
		}
	} else {
		printWarning(fmt.Sprintf("No stdout log: %v", err))
	}

	printStep("Showing stderr log")
	if lines, err := tailLines(stderrPath, *tail); err == nil {
		for _, line := range lines {
			fmt.Println(line)
		}
	} else {
		printWarning(fmt.Sprintf("No stderr log: %v", err))
	}
}

func startServer(opts startOptions) error {
	binary := resolveBinaryPath(opts.BinaryPath)
	config := resolveConfigPath(opts.ConfigPath)

	if !fileExists(binary) {
		return fmt.Errorf("binary not found: %s", binary)
	}
	if !fileExists(config) {
		return fmt.Errorf("config not found: %s", config)
	}

	if opts.Background {
		if err := ensureDir(logsDir()); err != nil {
			return err
		}
		stdoutPath := filepath.Join(logsDir(), "server-stdout.log")
		stderrPath := filepath.Join(logsDir(), "server-stderr.log")
		stdoutFile, err := os.Create(stdoutPath)
		if err != nil {
			return err
		}
		stderrFile, err := os.Create(stderrPath)
		if err != nil {
			_ = stdoutFile.Close()
			return err
		}

		cmd := exec.Command(binary, "--config", config)
		cmd.Stdout = stdoutFile
		cmd.Stderr = stderrFile
		cmd.Dir = configDir()
		if err := cmd.Start(); err != nil {
			_ = stdoutFile.Close()
			_ = stderrFile.Close()
			return err
		}
		_ = stdoutFile.Close()
		_ = stderrFile.Close()
		_ = writePid(cmd.Process.Pid)
		_ = cmd.Process.Release()
		printSuccess(fmt.Sprintf("Server started (PID %d)", cmd.Process.Pid))
		fmt.Printf("Endpoint: http://localhost:%d/v1\n", resolvePortFromConfig(config, 8317))
		return nil
	}

	printStep("Starting server in foreground...")
	cmd := exec.Command(binary, "--config", config)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	cmd.Dir = configDir()
	return cmd.Run()
}

func stopServer() error {
	pid, err := readPid()
	if err != nil {
		port := resolvePortFromConfig(configPath(), 8317)
		if isPortOpen(port) {
			printWarning("PID file not found; server might already be running without a PID")
		} else {
			printWarning("Server already stopped (no PID file found)")
		}
		return nil
	}
	proc, err := os.FindProcess(pid)
	if err != nil {
		return err
	}
	if err := proc.Kill(); err != nil {
		if isProcessAlreadyFinished(err) {
			removePid()
			printWarning("Server already stopped (stale PID removed)")
			return nil
		}
		return err
	}
	removePid()
	printSuccess("Server stopped")
	return nil
}

func isProcessAlreadyFinished(err error) bool {
	if err == nil {
		return false
	}
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "process already finished") ||
		strings.Contains(lower, "no such process") ||
		strings.Contains(lower, "process does not exist") ||
		strings.Contains(lower, "not found")
}

func getServerStatus() ServerStatus {
	port := resolvePortFromConfig(configPath(), 8317)
	status := ServerStatus{
		Running:  isPortOpen(port),
		PID:      0,
		Port:     port,
		Endpoint: fmt.Sprintf("http://localhost:%d/v1", port),
	}
	if pid, err := readPid(); err == nil {
		status.PID = pid
	}
	return status
}

func fetchModels(port int) ([]string, error) {
	client := &http.Client{Timeout: 3 * time.Second}
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("http://localhost:%d/v1/models", port), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer sk-dummy")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("models request failed: %s", resp.Status)
	}
	var payload struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := jsonNewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	models := make([]string, 0, len(payload.Data))
	for _, item := range payload.Data {
		models = append(models, item.ID)
	}
	return models, nil
}
