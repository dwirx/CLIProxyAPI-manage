import {
  Activity,
  BarChart3,
  RefreshCcw,
  TrendingUp
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { api, AnalyticsSummary, ModelUsageEntry } from '../lib/api';
import { extractPriceEntries, findPriceEntry, PriceEntry } from '../lib/pricing';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { ActivityLog } from '../components/ActivityLog';

export function Dashboard() {
  const status = useAppStore((state) => state.status);
  const stats = useAppStore((state) => state.stats);
  const refreshStatus = useAppStore((state) => state.refreshStatus);
  const refreshStats = useAppStore((state) => state.refreshStats);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [usageEntries, setUsageEntries] = useState<ModelUsageEntry[]>([]);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [pricingEntries, setPricingEntries] = useState<PriceEntry[]>([]);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const [range, setRange] = useState('Today');

  const ranges = ['Today', 'Yesterday', '7 Days', '30 Days', 'This Year', 'All Time'];

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const data = await api.analyticsSummary();
      if (data.success) {
        setSummary(data);
        setSummaryError(null);
      } else {
        setSummary(null);
        setSummaryError(data.error || 'Analytics unavailable');
      }
    } catch (err) {
      setSummary(null);
      setSummaryError('Analytics unavailable');
    }
    setLoadingSummary(false);
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const usageWindow = useMemo(() => {
    switch (range) {
      case 'Yesterday':
      case 'Today':
        return 1;
      case '7 Days':
        return 7;
      case '30 Days':
        return 30;
      case 'This Year':
        return 365;
      case 'All Time':
        return 3650;
      default:
        return 7;
    }
  }, [range]);

  const loadUsage = async (days: number) => {
    try {
      const data = await api.modelUsage({ days });
      if (data.success) {
        setUsageEntries(data.entries || []);
        setUsageError(null);
      } else {
        setUsageEntries([]);
        setUsageError('Usage data unavailable');
      }
    } catch (err) {
      setUsageEntries([]);
      setUsageError('Usage data unavailable');
    }
  };

  const loadPricing = async () => {
    try {
      const res = await fetch('/api/pricing');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const entries = extractPriceEntries(data);
      setPricingEntries(entries);
      setPricingError(null);
    } catch (err) {
      setPricingEntries([]);
      setPricingError('Pricing data unavailable');
    }
  };

  useEffect(() => {
    loadUsage(usageWindow);
  }, [usageWindow]);

  useEffect(() => {
    loadPricing();
  }, []);

  const refreshAll = async () => {
    await Promise.all([refreshStatus(), refreshStats(), loadSummary(), loadUsage(usageWindow), loadPricing()]);
    setUpdatedAt(new Date());
  };

  const totalRequests = stats?.total ?? 0;
  const success = stats?.success ?? 0;
  const errors = stats?.errors ?? 0;
  const totalTokens = summary?.totals.totalTokens ?? 0;

  const uptimeMinutes = status?.startTime
    ? Math.max(1, (Date.now() - new Date(status.startTime).getTime()) / 60000)
    : 1;
  const rpm = totalRequests / uptimeMinutes;
  const tpm = totalTokens / uptimeMinutes;
  const avgLatency = stats?.avgLatency ?? 0;

  const estimatedCost = totalTokens * 0.000002;

  const trendData = useMemo(() => {
    if (summary?.perDay?.length) {
      return summary.perDay.map((item) => ({
        name: item.date.slice(5),
        value: item.requests
      }));
    }
    return [
      { name: '00:00', value: 0 },
      { name: '02:00', value: 0 },
      { name: '04:00', value: 5 },
      { name: '06:00', value: 18 },
      { name: '08:00', value: 32 },
      { name: '10:00', value: 22 }
    ];
  }, [summary]);

  const costTotals = useMemo(() => {
    const providerTotals: Record<string, number> = {};
    let totalCost = 0;
    if (pricingEntries.length === 0) {
      return { totalCost, providerTotals };
    }
    for (const entry of usageEntries) {
      const price = findPriceEntry(pricingEntries, entry.model);
      if (!price) continue;
      const inputCost = (entry.promptTokens / 1_000_000) * price.inputPer1M;
      const outputCost = (entry.completionTokens / 1_000_000) * price.outputPer1M;
      const cost = inputCost + outputCost;
      totalCost += cost;
      const provider = price.provider || entry.provider;
      providerTotals[provider] = (providerTotals[provider] || 0) + cost;
    }
    return { totalCost, providerTotals };
  }, [pricingEntries, usageEntries]);

  const costBreakdown = useMemo(() => {
    const colors: Record<string, string> = {
      OpenAI: '#f97316',
      Anthropic: '#38bdf8',
      Google: '#34d399',
      Qwen: '#a855f7',
      Kiro: '#facc15',
      Unknown: '#94a3b8'
    };
    const entries = Object.entries(costTotals.providerTotals)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({
        name,
        value: Number(value.toFixed(2)),
        color: colors[name] || '#94a3b8'
      }));
    if (entries.length === 0) {
      return [{ name: 'No data', value: 100, color: '#334155' }];
    }
    const total = entries.reduce((acc, item) => acc + item.value, 0);
    return entries.map((entry) => ({
      ...entry,
      value: total ? Math.round((entry.value / total) * 100) : entry.value
    }));
  }, [costTotals.providerTotals]);

  const costLabel = pricingEntries.length > 0 ? formatUsd(costTotals.totalCost) : formatUsd(estimatedCost);
  const costMeta = pricingEntries.length > 0 ? `Pricing data (${usageWindow}d)` : 'Estimated';

  const usageByProvider = useMemo(() => {
    const map: Record<string, { tokens: number; requests: number; lastUsed?: string }> = {};
    for (const entry of usageEntries) {
      if (!map[entry.provider]) {
        map[entry.provider] = { tokens: 0, requests: 0 };
      }
      map[entry.provider].tokens += entry.totalTokens;
      map[entry.provider].requests += entry.requests;
      if (!map[entry.provider].lastUsed || entry.lastUsed > map[entry.provider].lastUsed!) {
        map[entry.provider].lastUsed = entry.lastUsed;
      }
    }
    return map;
  }, [usageEntries]);

  const tokenLabel = formatCompact(totalTokens);
  const requestLabel = formatCompact(totalRequests);

  return (
    <div className="grid gap-6">
      <section className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-3xl px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">CLIProxyAPI Dashboard</p>
          <h2 className="text-xl font-semibold text-white">Traffic & Usage Overview</h2>
          <p className="text-xs text-slate-400">Updated: {updatedAt.toLocaleTimeString()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-full border border-white/10 bg-black/30 p-1">
            {ranges.map((item) => (
              <button
                key={item}
                onClick={() => setRange(item)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs transition',
                  range === item
                    ? 'bg-primary/20 text-white'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs text-slate-300 transition hover:text-white"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[repeat(5,minmax(0,1fr))]">
        <MetricCard
          title="Total Requests"
          value={requestLabel}
          meta={`Success: ${success} - Failed: ${errors}`}
          accent="blue"
        />
        <MetricCard
          title="Total Tokens"
          value={tokenLabel}
          meta={`TPM: ${formatCompact(tpm)}`}
          accent="amber"
        />
        <MetricCard
          title="RPM"
          value={formatCompact(rpm)}
          meta={`Requests: ${requestLabel}`}
          accent="emerald"
        />
        <MetricCard
          title="TPM"
          value={formatCompact(tpm)}
          meta={`Latency: ${avgLatency.toFixed(0)}ms`}
          accent="violet"
        />
        <MetricCard
          title="Total Cost"
          value={costLabel}
          meta={costMeta}
          accent="teal"
        />
      </div>

      <section className="section-card grid gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Rate Limits</p>
            <h3 className="text-lg font-semibold text-white">Usage Limits</h3>
          </div>
          <Activity className="text-primary" size={20} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {['OpenAI', 'Anthropic', 'Google'].map((provider) => (
            <RateLimitCard
              key={provider}
              name={provider}
              usedTokens={usageByProvider[provider]?.tokens ?? 0}
              requestCount={usageByProvider[provider]?.requests ?? 0}
              lastUsed={usageByProvider[provider]?.lastUsed}
              accent={provider === 'OpenAI' ? 'blue' : provider === 'Anthropic' ? 'violet' : 'emerald'}
              limitTokens={null}
              windowLabel={`${usageWindow}d window`}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="section-card grid gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Request Trends</p>
              <h3 className="text-lg font-semibold text-white">Traffic Volume</h3>
            </div>
            <div className="badge-soft">Hour</div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12
                  }}
                  labelStyle={{ color: '#cbd5f5' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#trend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500">
            {loadingSummary
              ? 'Syncing analytics...'
              : summaryError || usageError || pricingError
                ? summaryError || usageError || pricingError
                : 'Realtime traffic trend based on proxy activity.'}
          </p>
        </section>

        <section className="section-card grid gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cost Breakdown</p>
              <h3 className="text-lg font-semibold text-white">Spend Split</h3>
            </div>
            <BarChart3 className="text-primary" size={20} />
          </div>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={costBreakdown}
                  dataKey="value"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {costBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2 text-xs text-slate-300">
            {costBreakdown.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                  {entry.name}
                </div>
                <span>{entry.value}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="section-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">System Pulse</p>
          <h3 className="text-lg font-semibold text-white">Latency & Health</h3>
          <p className="text-sm text-slate-400">
            Average latency {avgLatency.toFixed(0)}ms | Success rate{' '}
            {stats?.successRate?.toFixed(1) ?? '0.0'}%
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-base-300/60 px-4 py-3 text-sm text-slate-200">
            RPM <span className="font-semibold text-white">{formatCompact(rpm)}</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-base-300/60 px-4 py-3 text-sm text-slate-200">
            TPM <span className="font-semibold text-white">{formatCompact(tpm)}</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-base-300/60 px-4 py-3 text-sm text-slate-200">
            <TrendingUp className="inline-block text-primary" size={16} /> Live
          </div>
        </div>
      </section>

      <ActivityLog />
    </div>
  );
}

function MetricCard({
  title,
  value,
  meta,
  accent
}: {
  title: string;
  value: string;
  meta: string;
  accent: 'blue' | 'amber' | 'emerald' | 'violet' | 'teal';
}) {
  const accentClasses = {
    blue: 'from-blue-500/20 to-transparent text-blue-200',
    amber: 'from-amber-500/20 to-transparent text-amber-200',
    emerald: 'from-emerald-500/20 to-transparent text-emerald-200',
    violet: 'from-violet-500/20 to-transparent text-violet-200',
    teal: 'from-teal-500/20 to-transparent text-teal-200'
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-base-200/50 p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{title}</p>
        <div
          className={cn(
            'rounded-xl bg-gradient-to-br px-2 py-1 text-xs font-semibold',
            accentClasses[accent]
          )}
        >
          {title === 'Total Cost' ? '$' : title === 'RPM' ? 'RPM' : title === 'TPM' ? 'TPM' : 'SUM'}
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      <p className="mt-1 text-xs text-slate-400">{meta}</p>
    </div>
  );
}

function RateLimitCard({
  name,
  usedTokens,
  requestCount,
  lastUsed,
  limitTokens,
  accent,
  windowLabel
}: {
  name: string;
  usedTokens: number;
  requestCount: number;
  lastUsed?: string;
  limitTokens: number | null;
  accent: 'blue' | 'violet' | 'emerald';
  windowLabel: string;
}) {
  const accentColor = {
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    emerald: 'bg-emerald-500'
  }[accent];

  const percent = limitTokens ? Math.min(100, (usedTokens / limitTokens) * 100) : 100;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-white">{name}</div>
        <div className={`h-2 w-2 rounded-full ${accentColor}`} />
      </div>
      <div className="mt-3 text-xs text-slate-400">{windowLabel}</div>
      <div className="mt-2 text-sm text-slate-200">
        {formatCompact(usedTokens)} tokens - {formatCompact(requestCount)} requests
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-white/5">
        <div
          className={`h-2 rounded-full ${accentColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {limitTokens ? `Limit ${formatCompact(limitTokens)} tokens` : 'No limit configured'}{' '}
        {lastUsed ? `- last used ${formatDate(lastUsed)}` : ''}
      </div>
    </div>
  );
}

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(
    value
  );
}

function formatUsd(value: number) {
  if (!Number.isFinite(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
