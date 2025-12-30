import { Copy, PauseCircle, PlayCircle, RefreshCcw, Shield, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AccountInfo, AccountModelUsageEntry, api } from '../lib/api';
import { CopyToast } from './CopyToast';
import { useCopyFeedback } from '../lib/useCopyFeedback';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';
import { QuotaRule, defaultQuotaRules, findRuleForModel } from '../lib/quota';

const providerLabels: Record<string, string> = {
  gemini: 'Gemini',
  copilot: 'Copilot',
  antigravity: 'Antigravity',
  codex: 'Codex',
  claude: 'Claude',
  qwen: 'Qwen',
  iflow: 'iFlow',
  kiro: 'Kiro'
};

export function AccountsTable() {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState<string>('antigravity');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [usage, setUsage] = useState<AccountModelUsageEntry[]>([]);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageWindow, setUsageWindow] = useState(7);
  const [quotaRules, setQuotaRules] = useState<QuotaRule[]>(defaultQuotaRules);
  const addLog = useAppStore((state) => state.addLog);
  const refreshAuth = useAppStore((state) => state.refreshAuth);
  const setOauthProvider = useAppStore((state) => state.setOauthProvider);
  const copyFeedback = useCopyFeedback();

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
    const totals: Record<string, number> = {};
    for (const entry of usage) {
      if (!entry.accountId) continue;
      totals[entry.accountId] = (totals[entry.accountId] || 0) + entry.totalTokens;
    }
    return totals;
  }, [usage]);

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.accounts();
      if (!res.success) {
        setError('Failed to load accounts');
        setAccounts([]);
      } else {
        setAccounts(res.accounts || []);
      }
    } catch (err) {
      setError('Failed to load accounts');
      setAccounts([]);
    }
    setLoading(false);
  };

  const loadUsage = async () => {
    try {
      const [usageRes, quotaRes] = await Promise.all([
        api.accountModelUsage({ days: usageWindow }),
        api.quotaRules()
      ]);
      if (!usageRes.success) {
        setUsage([]);
        setUsageError('Usage data unavailable');
      } else {
        setUsage(usageRes.entries || []);
        setUsageError(null);
      }
      if (quotaRes.success && Array.isArray(quotaRes.rules) && quotaRes.rules.length > 0) {
        setQuotaRules(quotaRes.rules);
      } else {
        setQuotaRules(defaultQuotaRules);
      }
    } catch (err) {
      setUsage([]);
      setUsageError('Usage data unavailable');
      setQuotaRules(defaultQuotaRules);
    }
  };

  useEffect(() => {
    loadAccounts();
    loadUsage();
  }, [usageWindow]);

  const filteredAccounts = useMemo(() => {
    let filtered = accounts;
    if (providerFilter !== 'all') {
      filtered = filtered.filter((account) => account.provider === providerFilter);
    }
    if (statusFilter === 'active') {
      filtered = filtered.filter((account) => !account.disabled);
    }
    if (statusFilter === 'disabled') {
      filtered = filtered.filter((account) => account.disabled);
    }
    return filtered;
  }, [accounts, providerFilter, statusFilter]);

  const toggleSelectAll = () => {
    if (selected.size === filteredAccounts.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filteredAccounts.map((account) => account.id)));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const deleteAccount = async (id: string) => {
    const confirmDelete = window.confirm('Delete this account token?');
    if (!confirmDelete) {
      return;
    }
    const res = await api.deleteAccount(id);
    if (res.success) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: 'Account removed',
        type: 'success'
      });
      refreshAuth();
      loadAccounts();
    } else {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: res.error || 'Failed to remove account',
        type: 'error'
      });
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) {
      return;
    }
    const confirmDelete = window.confirm('Delete selected accounts?');
    if (!confirmDelete) {
      return;
    }
    for (const id of selected) {
      // eslint-disable-next-line no-await-in-loop
      await api.deleteAccount(id);
    }
    setSelected(new Set());
    refreshAuth();
    loadAccounts();
  };

  const setCurrentSelected = async () => {
    if (selected.size === 0) {
      return;
    }
    const confirmSet = window.confirm('Set selected accounts as current?');
    if (!confirmSet) {
      return;
    }
    const res = await api.setCurrentAccounts(Array.from(selected));
    if (res.success) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: 'Current account updated',
        type: 'success'
      });
      refreshAuth();
      loadAccounts();
    } else {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: res.error || 'Failed to set current account',
        type: 'error'
      });
    }
  };

  const disableSelected = async () => {
    if (selected.size === 0) {
      return;
    }
    const confirmDisable = window.confirm('Disable selected accounts?');
    if (!confirmDisable) {
      return;
    }
    const res = await api.disableAccounts(Array.from(selected));
    if (res.success) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: 'Accounts disabled',
        type: 'success'
      });
      refreshAuth();
      loadAccounts();
    } else {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: res.error || 'Failed to disable accounts',
        type: 'error'
      });
    }
  };

  const enableSelected = async () => {
    if (selected.size === 0) {
      return;
    }
    const confirmEnable = window.confirm('Enable selected accounts?');
    if (!confirmEnable) {
      return;
    }
    const res = await api.enableAccounts(Array.from(selected));
    if (res.success) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: 'Accounts enabled',
        type: 'success'
      });
      refreshAuth();
      loadAccounts();
    } else {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: res.error || 'Failed to enable accounts',
        type: 'error'
      });
    }
  };

  const toggleAccount = async (account: AccountInfo) => {
    if (account.disabled) {
      await api.enableAccounts([account.id]);
    } else {
      await api.disableAccounts([account.id]);
    }
    loadAccounts();
  };

  const setCurrentOne = async (id: string) => {
    const res = await api.setCurrentAccounts([id]);
    if (res.success) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: 'Current account updated',
        type: 'success'
      });
      refreshAuth();
      loadAccounts();
    } else {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: res.error || 'Failed to set current account',
        type: 'error'
      });
    }
  };

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      copyFeedback.trigger(`${label} copied`);
    } catch (err) {
      copyFeedback.trigger('Copy failed');
    }
  };

  return (
    <section id="accounts-table" className="section-card relative grid gap-4">
      <CopyToast message={copyFeedback.message} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Accounts</p>
          <h3 className="text-lg font-semibold text-white">Multi-Account Manager</h3>
          <p className="text-xs text-slate-500">
            Add accounts with the provider cards above. You can delete tokens here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-slate-300">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Add account</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="rounded-full border border-white/10 bg-black/40 px-2 py-1 text-xs text-slate-200"
            >
              {Object.entries(providerLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setOauthProvider(provider)}
              className="rounded-full border border-primary/30 px-3 py-1 text-xs text-primary transition hover:text-white"
            >
              Start OAuth
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-slate-300">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Filter</span>
            <select
              value={providerFilter}
              onChange={(event) => setProviderFilter(event.target.value)}
              className="rounded-full border border-white/10 bg-black/40 px-2 py-1 text-xs text-slate-200"
            >
              <option value="all">All providers</option>
              {Object.entries(providerLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-slate-300">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'disabled')}
              className="rounded-full border border-white/10 bg-black/40 px-2 py-1 text-xs text-slate-200"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-slate-300">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Usage window</span>
            <select
              value={usageWindow}
              onChange={(event) => setUsageWindow(Number(event.target.value))}
              className="rounded-full border border-white/10 bg-black/40 px-2 py-1 text-xs text-slate-200"
            >
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
          <button
            onClick={() => {
              loadAccounts();
              loadUsage();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:text-white"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
          <button
            onClick={setCurrentSelected}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 px-4 py-2 text-xs text-emerald-200 transition hover:text-white"
          >
            <Shield size={14} /> Set current
          </button>
          <button
            onClick={enableSelected}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 px-4 py-2 text-xs text-emerald-200 transition hover:text-white"
          >
            <PlayCircle size={14} /> Enable
          </button>
          <button
            onClick={disableSelected}
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-amber-200 transition hover:text-white"
          >
            <PauseCircle size={14} /> Disable
          </button>
          <button
            onClick={deleteSelected}
            className="inline-flex items-center gap-2 rounded-full border border-red-500/30 px-4 py-2 text-xs text-red-200 transition hover:text-white"
          >
            <Trash2 size={14} /> Delete selected
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[auto_1.6fr_2fr_1fr_0.8fr] gap-3 bg-black/40 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={filteredAccounts.length > 0 && selected.size === filteredAccounts.length}
              onChange={toggleSelectAll}
            />
          </label>
          <span>Email</span>
          <span>Model Quota</span>
          <span>Last Used</span>
          <span>Actions</span>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-400">Loading accounts...</div>
        ) : error ? (
          <div className="px-4 py-6 text-sm text-red-200">{error}</div>
        ) : filteredAccounts.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-400">No accounts found yet.</div>
        ) : (
          filteredAccounts.map((account) => {
            const dateLabel = formatDate(account.lastUsed);
            const providerLabel = providerLabels[account.provider] || account.provider;
            const accountUsage = usageByAccount[account.id] || [];
            const accountTotal = usageTotals[account.id] || 0;
            return (
              <div
                key={account.id}
                className={cn(
                  'grid grid-cols-[auto_1.6fr_2fr_1fr_0.8fr] gap-3 border-t border-white/5 px-4 py-3 text-sm text-slate-200',
                  account.current ? 'bg-white/5' : 'bg-transparent'
                )}
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={selected.has(account.id)}
                    onChange={() => toggleSelect(account.id)}
                  />
                </label>
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{account.email || 'Unknown'}</span>
                    {account.current && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-primary">
                        Current
                      </span>
                    )}
                    {account.disabled && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-200">
                        Disabled
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{providerLabel}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {accountUsage.length === 0 ? (
                    <span className="text-xs text-slate-400">
                      {usageError ? usageError : 'No usage data yet'}
                    </span>
                  ) : (
                    accountUsage.slice(0, 4).map((entry) => {
                      const rule = findRuleForModel(quotaRules, entry.model);
                      const percent = rule
                        ? Math.max(0, Math.round(100 - (entry.totalTokens / Math.max(1, rule.limitTokens)) * 100))
                        : accountTotal > 0
                          ? Math.round((entry.totalTokens / accountTotal) * 100)
                          : 0;
                      const label = entry.model.length > 22 ? `${entry.model.slice(0, 22)}...` : entry.model;
                      return (
                        <span
                          key={`${account.id}-${entry.model}`}
                          className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100"
                          title={`${entry.model} - ${formatCompact(entry.totalTokens)} tokens`}
                        >
                          {label} {percent}%
                        </span>
                      );
                    })
                  )}
                </div>
                <div className="text-xs text-slate-300">{dateLabel}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyValue('Email', account.email)}
                    className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:text-white"
                    title="Copy email"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => setCurrentOne(account.id)}
                    className="rounded-full border border-emerald-500/20 p-2 text-emerald-200 transition hover:text-white"
                    title="Set current"
                    disabled={account.disabled}
                  >
                    <Shield size={14} />
                  </button>
                  <button
                    onClick={() => toggleAccount(account)}
                    className="rounded-full border border-amber-500/20 p-2 text-amber-200 transition hover:text-white"
                    title={account.disabled ? 'Enable account' : 'Disable account'}
                  >
                    {account.disabled ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                  </button>
                  <button
                    onClick={() => deleteAccount(account.id)}
                    className="rounded-full border border-red-500/20 p-2 text-red-200 transition hover:text-white"
                    title="Delete account"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value
  );
}
