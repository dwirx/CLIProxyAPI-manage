import { useCallback, useEffect, useState } from 'react';
import { api, AnalyticsRecent } from '../lib/api';

export function RecentRequests() {
  const [data, setData] = useState<AnalyticsRecent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const load = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const result = await api.analyticsRecent();
      if (result.success) {
        setData(result);
        setError(null);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        setError(result.error || 'No logs yet');
      }
    } catch (err) {
      setError('Failed to load logs');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        load();
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [autoRefresh, load]);

  return (
    <section className="section-card grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Request Log</p>
          <h3 className="text-lg font-semibold text-white">Recent Playground Calls</h3>
          <p className="text-xs text-slate-500">
            {autoRefresh ? 'Live updates every 4s.' : 'Auto refresh paused.'}{' '}
            {lastUpdated ? `Last updated at ${lastUpdated}.` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span>Live</span>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
            />
          </label>
          <button
            type="button"
            onClick={() => load(true)}
            className="btn btn-outline btn-xs"
          >
            Refresh
          </button>
        </div>
      </div>
      {loading && !data && <p className="text-sm text-slate-400">Loading logs...</p>}
      {error && <p className="text-xs text-amber-200">{error}</p>}
      <div className="scrollbar-thin max-h-64 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-base-300/60 px-4 py-3">
        {data?.entries?.length ? (
          data.entries.map((entry) => (
            <div
              key={`${entry.timestamp}-${entry.model}`}
              className="flex items-start justify-between gap-4 text-sm"
            >
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
    </section>
  );
}
