import { KeyRound } from 'lucide-react';
import { ProvidersGrid } from '../components/ProvidersGrid';

export function Accounts() {
  return (
    <div className="grid gap-6">
      <ProvidersGrid />
      <section className="section-card grid gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/20 p-2 text-primary">
            <KeyRound size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tokens</p>
            <h3 className="text-lg font-semibold text-white">Local Auth Storage</h3>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          OAuth tokens are stored locally in <span className="text-slate-200">~/.cli-proxy-api</span>. Use the
          provider cards above to refresh logins.
        </p>
        <div className="rounded-xl border border-white/10 bg-base-300/50 px-4 py-3 text-xs text-slate-300">
          Tip: Use <code className="rounded bg-base-200/60 px-2 py-1">betacliproxyapi oauth --all</code> to
          refresh all providers in one go.
        </div>
      </section>
    </div>
  );
}
