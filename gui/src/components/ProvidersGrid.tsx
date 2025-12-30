import {
  BadgeCheck,
  Cloud,
  Flame,
  Github,
  Sparkles,
  TerminalSquare,
  X,
  Wind
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, OAuthSession } from '../lib/api';
import { CopyToast } from './CopyToast';
import { useAppStore } from '../store/useAppStore';
import { useCopyFeedback } from '../lib/useCopyFeedback';

const providers = [
  { id: 'gemini', label: 'Gemini', icon: Sparkles },
  { id: 'copilot', label: 'Copilot', icon: Github },
  { id: 'antigravity', label: 'Antigravity', icon: Flame },
  { id: 'codex', label: 'Codex', icon: TerminalSquare },
  { id: 'claude', label: 'Claude', icon: BadgeCheck },
  { id: 'qwen', label: 'Qwen', icon: Cloud },
  { id: 'iflow', label: 'iFlow', icon: Wind },
  { id: 'kiro', label: 'Kiro', icon: Sparkles }
];

export function ProvidersGrid() {
  const authStatus = useAppStore((state) => state.authStatus);
  const refreshAuth = useAppStore((state) => state.refreshAuth);
  const addLog = useAppStore((state) => state.addLog);
  const oauthProvider = useAppStore((state) => state.oauthProvider);
  const setOauthProvider = useAppStore((state) => state.setOauthProvider);
  const [session, setSession] = useState<OAuthSession | null>(null);
  const [input, setInput] = useState('');
  const outputRef = useRef<HTMLDivElement | null>(null);
  const authUrl = useMemo(() => extractAuthUrl(session?.output ?? ''), [session?.output]);
  const sshCommand = useMemo(() => extractSSHCommand(session?.output ?? ''), [session?.output]);
  const lastRunningRef = useRef<boolean>(false);
  const copyFeedback = useCopyFeedback();

  const login = async (provider: string) => {
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `Launching OAuth for ${provider}`,
      type: 'info'
    });
    const result = await api.oauthStart(provider);
    if (!result.success) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `OAuth failed: ${result.error ?? 'unknown error'}`,
        type: 'error'
      });
      return;
    }
    setSession(result);
    setInput('');
  };

  useEffect(() => {
    if (!oauthProvider) {
      return;
    }
    login(oauthProvider).finally(() => setOauthProvider(null));
  }, [oauthProvider, setOauthProvider]);

  useEffect(() => {
    if (!session?.sessionId) {
      return;
    }
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const next = await api.oauthStatus(session.sessionId);
        if (cancelled) {
          return;
        }
        if (next.success) {
          setSession(next);
          if (!next.running && interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      } catch (err) {
        if (!cancelled) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: 'OAuth status polling failed',
            type: 'warning'
          });
        }
      }
    };

    interval = setInterval(poll, 1500);
    poll();

    return () => {
      cancelled = true;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [session?.sessionId, addLog]);

  useEffect(() => {
    const isRunning = session?.running ?? false;
    if (lastRunningRef.current && !isRunning) {
      refreshAuth();
    }
    lastRunningRef.current = isRunning;
  }, [session?.running, refreshAuth]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [session?.output]);

  const sendInput = async () => {
    if (!session?.sessionId) {
      return;
    }
    const result = await api.oauthInput(session.sessionId, input);
    if (!result.success) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `OAuth input failed: ${result.error ?? 'unknown error'}`,
        type: 'error'
      });
      return;
    }
    setInput('');
  };

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      copyFeedback.trigger(`${label} copied`);
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `${label} copied to clipboard`,
        type: 'success'
      });
    } catch (err) {
      copyFeedback.trigger(`Failed to copy ${label}`);
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `Failed to copy ${label}`,
        type: 'warning'
      });
    }
  };

  const stopSession = async () => {
    if (!session?.sessionId) {
      return;
    }
    await api.oauthStop(session.sessionId);
    setSession(null);
  };

  return (
    <>
      <section className="section-card grid gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Providers</p>
          <h3 className="text-lg font-semibold text-white">OAuth Connections</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {providers.map((provider) => {
            const Icon = provider.icon;
            const connected = authStatus[provider.id];
            return (
              <button
                key={provider.id}
                onClick={() => login(provider.id)}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-base-200/60 p-4 text-left transition hover:border-white/20"
              >
                <div
                  className={`rounded-xl p-2 ${
                    connected ? 'bg-success/20 text-success' : 'bg-base-300 text-slate-300'
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <div className="font-semibold text-white">{provider.label}</div>
                  <div className="text-xs text-slate-400">
                    {connected ? 'Connected' : 'Click to login'}
                  </div>
                </div>
                <div className="ml-auto">
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${
                      connected ? 'bg-success' : 'bg-slate-500'
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>
      {session && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4">
          <div className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl">
            <CopyToast message={copyFeedback.message} />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">OAuth Console</p>
                <h3 className="text-lg font-semibold text-white">
                  {session.provider} login {session.running ? 'in progress' : 'finished'}
                </h3>
              </div>
              <button
                onClick={() => setSession(null)}
                className="rounded-full border border-white/10 p-2 text-slate-400 transition hover:text-white"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/60 p-4">
              <div
                ref={outputRef}
                className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap font-mono text-xs text-slate-200"
              >
                {session.output || 'Waiting for OAuth output...'}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">Connection status:</span>
              {session.running ? (
                <span className="rounded-full bg-warning/20 px-3 py-1 text-warning">Connecting</span>
              ) : authStatus[session.provider] ? (
                <span className="rounded-full bg-success/20 px-3 py-1 text-success">Connected</span>
              ) : (
                <span className="rounded-full bg-error/20 px-3 py-1 text-error">Not connected</span>
              )}
            </div>
            <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-base-200/30 p-4 text-xs text-slate-300">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Quick Actions</p>
              {authUrl ? (
                <div className="grid gap-2">
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <button
                      onClick={() => window.open(authUrl, '_blank', 'noopener,noreferrer')}
                      className="inline-flex items-center justify-center rounded-xl bg-primary/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary"
                    >
                      Open Authentication Link
                    </button>
                    <button
                      onClick={() => copyText('Auth link', authUrl)}
                      className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-200 transition hover:text-white"
                    >
                      Copy Link
                    </button>
                  </div>
                  <a
                    href={authUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-xs text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
                  >
                    {authUrl}
                  </a>
                </div>
              ) : (
                <p className="text-slate-400">Waiting for authentication URL...</p>
              )}
              {sshCommand ? (
                <div className="grid gap-2">
                  <div className="rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-[11px] text-slate-200">
                    {sshCommand}
                  </div>
                  <button
                    onClick={() => copyText('SSH command', sshCommand)}
                    className="w-fit rounded-full border border-white/10 px-4 py-2 text-xs text-slate-200 transition hover:text-white"
                  >
                    Copy SSH Command
                  </button>
                </div>
              ) : (
                <p className="text-slate-400">SSH tunnel command not detected yet.</p>
              )}
              <p className="text-slate-400">
                Steps: run the SSH command on your local machine, open the auth link in your browser,
                then paste the callback URL below (or press Send/Enter).
              </p>
            </div>
            {session.error && (
              <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
                {session.error}
              </div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Paste the callback URL here (not the SSH command)..."
                className="input input-bordered w-full bg-base-200/40 text-sm text-white"
                disabled={!session.running}
              />
              <button
                onClick={sendInput}
                className="btn btn-primary"
                disabled={!session.running}
              >
                Send / Enter
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Example callback: http://localhost:51121/oauth-callback?code=...
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <span>Tip: Follow the SSH tunnel command from the output on your local machine.</span>
              <button
                onClick={stopSession}
                className="rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:text-white"
              >
                Stop session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function extractAuthUrl(output: string) {
  const lines = output.split('\n');
  const startIndex = lines.findIndex((line) =>
    line.toLowerCase().includes('visit the following url')
  );
  if (startIndex >= 0) {
    for (let i = startIndex + 1; i < lines.length; i += 1) {
      const match = lines[i].match(/https?:\/\/[^\s]+/);
      if (match) {
        return match[0].replace(/[)>.,]+$/, '');
      }
    }
  }
  const fallback = output.match(/https?:\/\/[^\s]+/);
  if (!fallback) {
    return '';
  }
  return fallback[0].replace(/[)>.,]+$/, '');
}

function extractSSHCommand(output: string) {
  const line = output
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('ssh -L'));
  return line ?? '';
}
