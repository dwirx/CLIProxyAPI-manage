import { useEffect, useState } from 'react';
import { api, AnalyticsRecent } from '../lib/api';

export function RecentRequests() {
  const [data, setData] = useState<AnalyticsRecent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.analyticsRecent();
        if (result.success) {
          setData(result);
          setError(null);
        } else {
          setError(result.error || 'No logs yet');
        }
      } catch (err) {
        setError('Failed to load logs');
      }
    };
    load();
  }, []);

  return (
    <section className="section-card grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Request Log</p>
        <h3 className="text-lg font-semibold text-white">Recent Playground Calls</h3>
      </div>
      {error ? (
        <p className="text-sm text-slate-400">{error}</p>
      ) : (
        <div className="scrollbar-thin max-h-64 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-base-300/60 px-4 py-3">
          {data?.entries?.length ? (
            data.entries.map((entry) => (
              <div key={`${entry.timestamp}-${entry.model}`} className="flex items-start justify-between gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500">{entry.timestamp}</div>
                  <div className="text-slate-200">{entry.model || 'Unknown model'}</div>
                  <div className="text-xs text-slate-500">{entry.provider}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">{entry.totalTokens} tokens</div>
                  <div className={entry.success ? 'text-success' : 'text-error'}>
                    {entry.success ? 'Success' : 'Failed'}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No logs yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
