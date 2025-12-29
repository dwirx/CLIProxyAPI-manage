import { useEffect, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { api, AnalyticsSummary } from '../lib/api';

export function UsageAnalytics() {
  const [state, setState] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.analyticsSummary();
        if (data.success) {
          setState(data);
          setError(null);
        } else {
          setError(data.error || 'No analytics data');
        }
      } catch (err) {
        setError('Failed to load analytics');
      }
    };
    load();
  }, []);

  if (error) {
    return (
      <section className="section-card grid gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Analytics</p>
        <p className="text-sm text-slate-400">{error}</p>
        <p className="text-xs text-slate-500">Run playground requests to populate analytics.</p>
      </section>
    );
  }

  if (!state) {
    return (
      <section className="section-card grid gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Analytics</p>
        <p className="text-sm text-slate-400">Loading analytics...</p>
      </section>
    );
  }

  return (
    <section className="section-card grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Analytics</p>
        <h3 className="text-lg font-semibold text-white">Usage Overview</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-base-300/50 p-4">
          <p className="text-xs text-slate-400">Requests</p>
          <p className="text-2xl font-semibold text-white">{state.totals.requests}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-base-300/50 p-4">
          <p className="text-xs text-slate-400">Total tokens</p>
          <p className="text-2xl font-semibold text-white">{state.totals.totalTokens}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-base-300/50 p-4">
          <p className="text-xs text-slate-400">Success rate</p>
          <p className="text-2xl font-semibold text-white">
            {state.totals.successRate.toFixed(1)}%
          </p>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={state.perDay}>
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: '#111720',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                color: '#f8fafc'
              }}
            />
            <Line type="monotone" dataKey="tokens" stroke="#14b8a6" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-xl border border-white/10 bg-base-300/50 p-4">
        <p className="text-xs text-slate-400">Top models</p>
        <div className="mt-2 space-y-2 text-sm text-slate-300">
          {state.topModels.length === 0 ? (
            <p className="text-slate-400">No model usage yet.</p>
          ) : (
            state.topModels.map((entry) => (
              <div key={entry.model} className="flex items-center justify-between">
                <span className="truncate">{entry.model}</span>
                <span className="text-white">{entry.tokens} tokens</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
