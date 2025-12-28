import {
  BadgeCheck,
  Cloud,
  Flame,
  Github,
  Sparkles,
  TerminalSquare,
  Wind
} from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

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
  const addLog = useAppStore((state) => state.addLog);

  const login = async (provider: string) => {
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `Launching OAuth for ${provider}`,
      type: 'info'
    });
    fetch(`/api/oauth/${provider}`, { method: 'POST' });
  };

  return (
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
              <div className={`rounded-xl p-2 ${connected ? 'bg-success/20 text-success' : 'bg-base-300 text-slate-300'}`}>
                <Icon size={18} />
              </div>
              <div>
                <div className="font-semibold text-white">{provider.label}</div>
                <div className="text-xs text-slate-400">
                  {connected ? 'Connected' : 'Click to login'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
