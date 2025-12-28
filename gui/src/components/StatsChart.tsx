import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useAppStore } from '../store/useAppStore';

export function StatsChart() {
  const stats = useAppStore((state) => state.stats);

  const data = useMemo(
    () => [
      { name: 'Success', value: stats?.success || 0 },
      { name: 'Errors', value: stats?.errors || 0 }
    ],
    [stats]
  );

  return (
    <section className="section-card grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Traffic</p>
        <h3 className="text-lg font-semibold text-white">Request Health</h3>
        <p className="text-sm text-slate-400">
          Success rate {stats?.successRate?.toFixed(1) || '0.0'}% · Avg latency{' '}
          {stats?.avgLatency?.toFixed(0) || 0}ms
        </p>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="success" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="errors" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{
                background: '#111720',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                color: '#f8fafc'
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#22c55e"
              fill="url(#success)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm text-slate-300">
        <div>
          <div className="text-xs text-slate-400">Total</div>
          <div className="text-lg font-semibold text-white">{stats?.total ?? 0}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Success</div>
          <div className="text-lg font-semibold text-white">{stats?.success ?? 0}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Errors</div>
          <div className="text-lg font-semibold text-white">{stats?.errors ?? 0}</div>
        </div>
      </div>
    </section>
  );
}
