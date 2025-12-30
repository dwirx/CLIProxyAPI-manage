import { ArrowRight, Download, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AccountInfo, AccountModelUsageEntry, api } from '../lib/api';
import { CopyToast } from './CopyToast';
import { useCopyFeedback } from '../lib/useCopyFeedback';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { QuotaRule, defaultQuotaRules, findRuleForModel, getRuleById } from '../lib/quota';

const fiveHours = 5 * 60 * 60 * 1000;

type QuotaSnapshot = {
  gemini: number;
  geminiImage: number;
  claude: number;
};

export function AntigravityOverview() {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [usage, setUsage] = useState<AccountModelUsageEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [quotaRules, setQuotaRules] = useState<QuotaRule[]>(defaultQuotaRules);
  const [now, setNow] = useState(() => Date.now());
  const addLog = useAppStore((state) => state.addLog);
  const copyFeedback = useCopyFeedback();

  const loadData = async () => {
    try {
      const [accountsRes, usageRes, quotaRes] = await Promise.all([
        api.accounts(),
        api.accountModelUsage({ hours: 5 }),
        api.quotaRules()
      ]);
      if (accountsRes.success) {
        setAccounts(accountsRes.accounts || []);
      }
      if (usageRes.success) {
        setUsage(usageRes.entries || []);
      } else {
        setUsage([]);
      }
      if (quotaRes.success && Array.isArray(quotaRes.rules) && quotaRes.rules.length > 0) {
        setQuotaRules(quotaRes.rules);
      } else {
        setQuotaRules(defaultQuotaRules);
      }
      setError(null);
    } catch (err) {
      setError('Unable to load overview data');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.provider === 'antigravity' && !account.disabled),
    [accounts]
  );

  const currentAccount = useMemo(() => {
    const current = activeAccounts.find((account) => account.current);
    if (current) return current;
    if (activeAccounts.length === 0) return null;
    const sorted = [...activeAccounts].sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
    return sorted[0];
  }, [activeAccounts]);

  const usageByAccount = useMemo(() => {
    const map: Record<string, AccountModelUsageEntry[]> = {};
    for (const entry of usage) {
      if (!entry.accountId) continue;
      if (!map[entry.accountId]) {
        map[entry.accountId] = [];
      }
      map[entry.accountId].push(entry);
    }
    Object.values(map).forEach((items) =>
      items.sort((a, b) => b.totalTokens - a.totalTokens)
    );
    return map;
  }, [usage]);

  const usageTotals = useMemo(() => {
    const activeIDs = new Set(activeAccounts.map((account) => account.id));
    const totals: Record<string, number> = {};
    for (const entry of usage) {
      if (!entry.accountId || !activeIDs.has(entry.accountId)) continue;
      totals[entry.accountId] = (totals[entry.accountId] || 0) + entry.totalTokens;
    }
    return totals;
  }, [usage, activeAccounts]);

  const resetCountdown = useMemo(() => {
    if (!currentAccount?.lastUsed) {
      return formatDuration(fiveHours);
    }
    return computeResetCountdown(currentAccount.lastUsed, now);
  }, [currentAccount?.lastUsed, now]);

  const resolvedRules = useMemo(() => {
    const rules = quotaRules.length > 0 ? quotaRules : defaultQuotaRules;
    return {
      gemini: getRuleById(rules, 'gemini'),
      geminiImage: getRuleById(rules, 'gemini-image'),
      claude: getRuleById(rules, 'claude')
    };
  }, [quotaRules]);

  const accountQuotaMap = useMemo(() => {
    const geminiRule = resolvedRules.gemini;
    const geminiImageRule = resolvedRules.geminiImage;
    const claudeRule = resolvedRules.claude;
    const map: Record<string, QuotaSnapshot> = {};
    for (const account of activeAccounts) {
      const entries = usageByAccount[account.id] || [];
      const usedByRule: Record<string, number> = {};
      for (const entry of entries) {
        const rule = findRuleForModel(quotaRules, entry.model);
        if (!rule) continue;
        usedByRule[rule.id] = (usedByRule[rule.id] || 0) + entry.totalTokens;
      }
      map[account.id] = {
        gemini: computeQuotaPercent(
          usedByRule[geminiRule?.id || ''] || 0,
          geminiRule?.limitTokens || 0
        ),
        geminiImage: computeQuotaPercent(
          usedByRule[geminiImageRule?.id || ''] || 0,
          geminiImageRule?.limitTokens || 0
        ),
        claude: computeQuotaPercent(
          usedByRule[claudeRule?.id || ''] || 0,
          claudeRule?.limitTokens || 0
        )
      };
    }
    return map;
  }, [activeAccounts, usageByAccount, resolvedRules, quotaRules]);

  const avgQuota = useMemo(() => {
    if (activeAccounts.length === 0) {
      return { gemini: 0, geminiImage: 0, claude: 0 };
    }
    const total = activeAccounts.reduce(
      (acc, account) => {
        const quota = accountQuotaMap[account.id] || defaultQuotaSnapshot();
        acc.gemini += quota.gemini;
        acc.geminiImage += quota.geminiImage;
        acc.claude += quota.claude;
        return acc;
      },
      { gemini: 0, geminiImage: 0, claude: 0 }
    );
    return {
      gemini: Math.round(total.gemini / activeAccounts.length),
      geminiImage: Math.round(total.geminiImage / activeAccounts.length),
      claude: Math.round(total.claude / activeAccounts.length)
    };
  }, [activeAccounts, accountQuotaMap]);

  const currentQuota = useMemo(() => {
    if (!currentAccount) {
      return { gemini: 0, geminiImage: 0, claude: 0 };
    }
    return accountQuotaMap[currentAccount.id] || defaultQuotaSnapshot();
  }, [currentAccount, accountQuotaMap]);

  const lowQuotaAccounts = useMemo(() => {
    if (activeAccounts.length === 0) return 0;
    return activeAccounts.filter((account) => {
      const quota = accountQuotaMap[account.id] || defaultQuotaSnapshot();
      return Math.min(quota.gemini, quota.geminiImage, quota.claude) < 20;
    }).length;
  }, [activeAccounts, accountQuotaMap]);

  const bestGeminiAccount = useMemo(
    () => pickBestAccount(activeAccounts, accountQuotaMap, (quota) => quota.gemini),
    [activeAccounts, accountQuotaMap]
  );

  const bestClaudeAccount = useMemo(
    () => pickBestAccount(activeAccounts, accountQuotaMap, (quota) => quota.claude),
    [activeAccounts, accountQuotaMap]
  );

  const bestOverallAccount = useMemo(
    () =>
      pickBestAccount(activeAccounts, accountQuotaMap, (quota) =>
        Math.min(quota.gemini, quota.geminiImage, quota.claude)
      ),
    [activeAccounts, accountQuotaMap]
  );

  const bestGeminiQuota = useMemo(() => {
    if (!bestGeminiAccount) return 0;
    return (accountQuotaMap[bestGeminiAccount.id] || defaultQuotaSnapshot()).gemini;
  }, [bestGeminiAccount, accountQuotaMap]);

  const bestClaudeQuota = useMemo(() => {
    if (!bestClaudeAccount) return 0;
    return (accountQuotaMap[bestClaudeAccount.id] || defaultQuotaSnapshot()).claude;
  }, [bestClaudeAccount, accountQuotaMap]);

  const switchToBest = async () => {
    if (!bestOverallAccount) return;
    const res = await api.setCurrentAccounts([bestOverallAccount.id]);
    if (res.success) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: 'Switched to best account',
        type: 'success'
      });
      loadData();
    }
  };

  const switchToNext = async () => {
    if (activeAccounts.length < 2) return;
    const sorted = [...activeAccounts].sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
    const currentIndex = sorted.findIndex((account) => account.id === currentAccount?.id);
    const next = sorted[(currentIndex + 1) % sorted.length];
    const res = await api.setCurrentAccounts([next.id]);
    if (res.success) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: 'Switched account',
        type: 'success'
      });
      loadData();
    }
  };

  const exportData = async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      accounts: activeAccounts,
      usageTotals
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'antigravity-accounts.json';
    link.click();
    URL.revokeObjectURL(url);
    copyFeedback.trigger('Exported');
  };

  if (error) {
    return (
      <section className="section-card grid gap-2">
        <p className="text-sm text-red-200">{error}</p>
      </section>
    );
  }

  return (
    <section className="section-card relative grid gap-4">
      <CopyToast message={copyFeedback.message} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Antigravity</p>
          <h3 className="text-lg font-semibold text-white">Accounts Overview (5h reset)</h3>
          <p className="text-xs text-slate-500">Quota window resets every 5 hours. Reset in {resetCountdown}.</p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:text-white"
        >
          <ArrowRight size={14} /> Refresh
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[repeat(5,minmax(0,1fr))]">
        <SummaryCard
          title="Total Accounts"
          value={String(activeAccounts.length)}
          subtitle="Active Antigravity accounts"
          accent="blue"
          icon={<Users size={16} />}
        />
        <SummaryCard
          title="Avg Gemini Quota"
          value={`${avgQuota.gemini}%`}
          subtitle={avgQuota.gemini > 20 ? 'Quota sufficient' : 'Low quota'}
          accent="emerald"
          icon={<Sparkles size={16} />}
        />
        <SummaryCard
          title="Avg Gemini Image Quota"
          value={`${avgQuota.geminiImage}%`}
          subtitle={avgQuota.geminiImage > 20 ? 'Quota sufficient' : 'Low quota'}
          accent="violet"
          icon={<Sparkles size={16} />}
        />
        <SummaryCard
          title="Avg Claude Quota"
          value={`${avgQuota.claude}%`}
          subtitle={avgQuota.claude > 20 ? 'Quota sufficient' : 'Low quota'}
          accent="cyan"
          icon={<ShieldCheck size={16} />}
        />
        <SummaryCard
          title="Low Quota Accounts"
          value={String(lowQuotaAccounts)}
          subtitle="Quota < 20%"
          accent="amber"
          icon={<ShieldCheck size={16} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck size={16} className="text-emerald-300" /> Current Account
          </div>
          <div className="mt-2 text-sm text-slate-300">
            {currentAccount ? currentAccount.email : 'No active account'}
          </div>
          <div className="mt-4 grid gap-3">
            <QuotaRow label="Gemini 3 Pro" percent={currentQuota.gemini} reset={resetCountdown} />
            <QuotaRow label="Gemini 3 Flash" percent={currentQuota.geminiImage} reset={resetCountdown} />
            <QuotaRow label="Claude 4.5" percent={currentQuota.claude} reset={resetCountdown} />
          </div>
          <button
            onClick={switchToNext}
            disabled={activeAccounts.length < 2}
            className="mt-4 w-full rounded-full border border-white/10 px-4 py-2 text-xs text-slate-200 transition hover:text-white disabled:opacity-40"
          >
            Switch Account
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-sm font-semibold text-white">Best Accounts</div>
          <div className="mt-3 grid gap-3">
            <BestAccountCard label="For Gemini" account={bestGeminiAccount} percent={bestGeminiQuota} />
            <BestAccountCard label="For Claude" account={bestClaudeAccount} percent={bestClaudeQuota} />
          </div>
          <button
            onClick={switchToBest}
            disabled={!bestOverallAccount}
            className="mt-4 w-full rounded-full bg-primary/80 px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary disabled:opacity-40"
          >
            Switch to Best
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          onClick={() => {
            const element = document.getElementById('accounts-table');
            element?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-200 transition hover:text-white"
        >
          View All Accounts
          <ArrowRight size={16} />
        </button>
        <button
          onClick={exportData}
          className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-200 transition hover:text-white"
        >
          Export Data
          <Download size={16} />
        </button>
      </div>
    </section>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  accent,
  icon
}: {
  title: string;
  value: string;
  subtitle: string;
  accent: 'blue' | 'emerald' | 'violet' | 'cyan' | 'amber';
  icon: React.ReactNode;
}) {
  const accentClasses = {
    blue: 'border-blue-500/30 text-blue-200',
    emerald: 'border-emerald-500/30 text-emerald-200',
    violet: 'border-violet-500/30 text-violet-200',
    cyan: 'border-cyan-500/30 text-cyan-200',
    amber: 'border-amber-500/30 text-amber-200'
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{title}</span>
        <span className={cn('rounded-full border px-2 py-1 text-[10px]', accentClasses[accent])}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      <div className="text-xs text-emerald-300">{subtitle}</div>
    </div>
  );
}

function QuotaRow({ label, percent, reset }: { label: string; percent: number; reset: string }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>R: {reset}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/5">
        <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${percent}%` }} />
      </div>
      <div className="text-right text-xs text-emerald-200">{percent}%</div>
    </div>
  );
}

function BestAccountCard({
  label,
  account,
  percent
}: {
  label: string;
  account: AccountInfo | null;
  percent: number;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
      <div className="text-xs text-emerald-200">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">
        {account ? account.email : 'No account'}
      </div>
      <div className="mt-2 text-right text-xs text-emerald-200">{percent}%</div>
    </div>
  );
}

function defaultQuotaSnapshot(): QuotaSnapshot {
  return { gemini: 100, geminiImage: 100, claude: 100 };
}

function pickBestAccount(
  accounts: AccountInfo[],
  quotaMap: Record<string, QuotaSnapshot>,
  score: (quota: QuotaSnapshot) => number
): AccountInfo | null {
  if (accounts.length === 0) return null;
  let best: AccountInfo | null = null;
  let bestScore = -Infinity;
  for (const account of accounts) {
    const quota = quotaMap[account.id] || defaultQuotaSnapshot();
    const value = score(quota);
    if (best === null || value > bestScore) {
      best = account;
      bestScore = value;
    }
  }
  return best;
}

function computeQuotaPercent(usedTokens: number, limit: number) {
  if (!limit) return 100;
  const remaining = Math.max(0, 100 - (usedTokens / limit) * 100);
  return Math.round(remaining);
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function computeResetCountdown(lastUsed: string, now: number) {
  const last = new Date(lastUsed).getTime();
  if (Number.isNaN(last)) {
    return formatDuration(fiveHours);
  }
  const nextReset = last + fiveHours;
  const remaining = Math.max(0, nextReset - now);
  return formatDuration(remaining);
}
