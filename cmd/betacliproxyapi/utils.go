package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

func printStep(msg string) {
	fmt.Printf("[*] %s\n", msg)
}

func printSuccess(msg string) {
	fmt.Printf("[+] %s\n", msg)
}

func printWarning(msg string) {
	fmt.Printf("[!] %s\n", msg)
}

func printError(msg string) {
	fmt.Fprintf(os.Stderr, "[-] %s\n", msg)
}

func ensureDir(path string) error {
	return os.MkdirAll(path, 0o755)
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func confirmPrompt(prompt string) bool {
	reader := bufio.NewReader(os.Stdin)
	fmt.Printf("%s [y/N]: ", prompt)
	line, _ := reader.ReadString('\n')
	line = strings.TrimSpace(line)
	return strings.EqualFold(line, "y") || strings.EqualFold(line, "yes")
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}

func tailLines(path string, maxLines int) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
		if len(lines) > maxLines {
			lines = lines[1:]
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return lines, nil
}

func isPortOpen(port int) bool {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 500*time.Millisecond)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

func writePid(pid int) error {
	return os.WriteFile(pidPath(), []byte(fmt.Sprintf("%d", pid)), 0o644)
}

func readPid() (int, error) {
	data, err := os.ReadFile(pidPath())
	if err != nil {
		return 0, err
	}
	var pid int
	_, err = fmt.Sscanf(strings.TrimSpace(string(data)), "%d", &pid)
	if err != nil {
		return 0, err
	}
	return pid, nil
}

func removePid() {
	_ = os.Remove(pidPath())
}

func copyFile(src, dest string, mode os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := ensureDir(filepath.Dir(dest)); err != nil {
		return err
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer func() {
		_ = out.Close()
	}()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	if err := out.Chmod(mode); err != nil {
		return err
	}
	return nil
}

func defaultFileMode() os.FileMode {
	if runtime.GOOS == "windows" {
		return 0o644
	}
	return 0o755
}

func resolveBinaryPath(path string) string {
	if path != "" {
		return path
	}
	return binaryPath()
}

func resolveConfigPath(path string) string {
	if path != "" {
		return path
	}
	return configPath()
}

func resolvePortFromConfig(path string, fallback int) int {
	data, err := os.ReadFile(path)
	if err != nil {
		return fallback
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "port:") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				var port int
				if _, err := fmt.Sscanf(parts[1], "%d", &port); err == nil {
					return port
				}
			}
		}
	}
	return fallback
}

func runCommand(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func requireCommand(name string) error {
	if _, err := exec.LookPath(name); err != nil {
		return fmt.Errorf("missing %s in PATH", name)
	}
	return nil
}

func readJSONBody(r io.Reader, v interface{}) error {
	dec := jsonNewDecoder(r)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return err
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return errors.New("unexpected extra JSON")
	}
	return nil
}

func jsonNewDecoder(r io.Reader) *json.Decoder {
	return json.NewDecoder(r)
}
