import { Power, RefreshCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export function StatusCard() {
  const status = useAppStore((state) => state.status);
  const refreshStatus = useAppStore((state) => state.refreshStatus);
  const addLog = useAppStore((state) => state.addLog);

  const running = status?.running ?? false;
  const endpoint = status?.endpoint || `http://localhost:${status?.port || 8317}/v1`;
  const uptime = status?.startTime
    ? formatDistanceToNow(new Date(status.startTime), { addSuffix: true })
    : '—';

  const runAction = async (action: 'start' | 'stop' | 'restart') => {
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `${action.toUpperCase()} command sent`,
      type: 'info'
    });
    try {
      if (action === 'start') await api.start();
      if (action === 'stop') await api.stop();
      if (action === 'restart') await api.restart();
      await refreshStatus();
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `${action.toUpperCase()} completed`,
        type: 'success'
      });
    } catch (err) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `${action.toUpperCase()} failed`,
        type: 'error'
      });
    }
  };

  return (
    <section className="section-card grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Status</p>
          <h2 className="text-xl font-semibold text-white">
            {running ? 'Running' : 'Stopped'}
          </h2>
          <p className="text-sm text-slate-400">Endpoint: {endpoint}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${running ? 'bg-success' : 'bg-warning'}`} />
          <span className="text-sm text-slate-300">Uptime: {uptime}</span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <button
          className="btn btn-primary flex items-center gap-2"
          onClick={() => runAction('start')}
          disabled={running}
        >
          <Power size={16} /> Start
        </button>
        <button
          className="btn btn-outline btn-warning flex items-center gap-2"
          onClick={() => runAction('stop')}
          disabled={!running}
        >
          <Power size={16} /> Stop
        </button>
        <button
          className="btn btn-outline flex items-center gap-2"
          onClick={() => runAction('restart')}
        >
          <RefreshCcw size={16} /> Restart
        </button>
      </div>
    </section>
  );
}
