package main

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"
)

const oauthOutputLimit = 128 * 1024

type oauthSession struct {
	id       string
	provider string
	cmd      *exec.Cmd
	stdin    io.WriteCloser
	output   []byte
	started  time.Time
	done     bool
	exitErr  string
	mu       sync.Mutex
}

type oauthSessionView struct {
	Success   bool   `json:"success"`
	SessionID string `json:"sessionId"`
	Provider  string `json:"provider"`
	Running   bool   `json:"running"`
	Output    string `json:"output"`
	Error     string `json:"error,omitempty"`
}

var (
	oauthSessions   = map[string]*oauthSession{}
	oauthSessionsMu sync.Mutex
)

func startOAuthSession(provider string) (*oauthSession, error) {
	flag := oauthFlag(provider)
	if flag == "" {
		return nil, errors.New("unknown provider")
	}
	if !fileExists(binaryPath()) {
		return nil, errors.New("cliproxyapi-plus binary not found, run install first")
	}
	if !fileExists(configPath()) {
		return nil, errors.New("config.yaml not found, run install first")
	}

	oauthSessionsMu.Lock()
	for id, session := range oauthSessions {
		if session.provider == provider && session.isRunning() {
			_ = session.stop()
			delete(oauthSessions, id)
		}
	}
	oauthSessionsMu.Unlock()

	cmd := exec.Command(binaryPath(), "--config", configPath(), flag)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}

	session := &oauthSession{
		id:       newSessionID(),
		provider: provider,
		cmd:      cmd,
		stdin:    stdin,
		started:  time.Now(),
	}

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	writer := oauthOutputWriter{session: session}
	go func() {
		_, _ = io.Copy(writer, stdout)
	}()
	go func() {
		_, _ = io.Copy(writer, stderr)
	}()
	go func() {
		err := cmd.Wait()
		session.markDone(err)
		time.AfterFunc(10*time.Minute, func() {
			removeOAuthSession(session.id)
		})
	}()

	oauthSessionsMu.Lock()
	oauthSessions[session.id] = session
	oauthSessionsMu.Unlock()

	return session, nil
}

func getOAuthSession(id string) (*oauthSession, bool) {
	oauthSessionsMu.Lock()
	defer oauthSessionsMu.Unlock()
	session, ok := oauthSessions[id]
	return session, ok
}

func removeOAuthSession(id string) {
	oauthSessionsMu.Lock()
	delete(oauthSessions, id)
	oauthSessionsMu.Unlock()
}

func handleOAuth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	provider := strings.TrimPrefix(r.URL.Path, "/api/oauth/")
	session, err := startOAuthSession(provider)
	if err != nil {
		writeJSON(w, http.StatusOK, oauthSessionView{Success: false, Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, session.snapshot())
}

func handleOAuthSession(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/oauth/session/")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing session id"})
		return
	}

	session, ok := getOAuthSession(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, oauthSessionView{Success: false, Error: "session not found"})
		return
	}

	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, session.snapshot())
	case http.MethodPost:
		var payload struct {
			Input string `json:"input"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid JSON"})
			return
		}
		if err := session.sendInput(payload.Input); err != nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
	case http.MethodDelete:
		_ = session.stop()
		removeOAuthSession(id)
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *oauthSession) snapshot() oauthSessionView {
	s.mu.Lock()
	defer s.mu.Unlock()
	return oauthSessionView{
		Success:   true,
		SessionID: s.id,
		Provider:  s.provider,
		Running:   !s.done,
		Output:    string(s.output),
		Error:     s.exitErr,
	}
}

func (s *oauthSession) isRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return !s.done
}

func (s *oauthSession) appendOutput(p []byte) {
	if len(p) == 0 {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.output = append(s.output, p...)
	if len(s.output) > oauthOutputLimit {
		s.output = s.output[len(s.output)-oauthOutputLimit:]
	}
}

func (s *oauthSession) markDone(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.done = true
	if err != nil {
		s.exitErr = err.Error()
	}
}

func (s *oauthSession) sendInput(input string) error {
	s.mu.Lock()
	stdin := s.stdin
	done := s.done
	s.mu.Unlock()
	if done {
		return errors.New("session already finished")
	}
	if stdin == nil {
		return errors.New("stdin unavailable")
	}
	if !strings.HasSuffix(input, "\n") {
		input += "\n"
	}
	_, err := io.WriteString(stdin, input)
	return err
}

func (s *oauthSession) stop() error {
	s.mu.Lock()
	cmd := s.cmd
	s.mu.Unlock()
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	return cmd.Process.Kill()
}

type oauthOutputWriter struct {
	session *oauthSession
}

func (w oauthOutputWriter) Write(p []byte) (int, error) {
	w.session.appendOutput(p)
	return len(p), nil
}

func newSessionID() string {
	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("%d-%x", time.Now().UnixNano(), buf)
}
