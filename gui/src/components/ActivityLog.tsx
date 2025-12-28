import { useAppStore } from '../store/useAppStore';

export function ActivityLog() {
  const logs = useAppStore((state) => state.logs);
  const clearLogs = useAppStore((state) => state.clearLogs);

  return (
    <section className="section-card grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Activity</p>
          <h3 className="text-lg font-semibold text-white">Recent Events</h3>
        </div>
        <button className="btn btn-outline btn-sm" onClick={clearLogs}>
          Clear
        </button>
      </div>
      <div className="scrollbar-thin max-h-96 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-base-300/60 px-4 py-3">
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400">No activity yet.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 text-sm">
              <span className="text-xs text-slate-500">{log.time}</span>
              <span
                className={
                  log.type === 'success'
                    ? 'text-success'
                    : log.type === 'warning'
                      ? 'text-warning'
                      : log.type === 'error'
                        ? 'text-error'
                        : 'text-slate-200'
                }
              >
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
