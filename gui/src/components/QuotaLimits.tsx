import { Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CopyToast } from './CopyToast';
import { useCopyFeedback } from '../lib/useCopyFeedback';
import { QuotaRule, defaultQuotaRules } from '../lib/quota';
import { api } from '../lib/api';

type EditableRule = QuotaRule & { localId: string };

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function QuotaLimits() {
  const [rules, setRules] = useState<EditableRule[]>([]);
  const [baseline, setBaseline] = useState<QuotaRule[]>(defaultQuotaRules);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const copyFeedback = useCopyFeedback();

  const hasChanges = useMemo(() => {
    const current = rules.map(({ localId, ...rest }) => rest);
    return JSON.stringify(current) !== JSON.stringify(baseline);
  }, [rules, baseline]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await api.quotaRules();
      if (res.success && Array.isArray(res.rules) && res.rules.length > 0) {
        setBaseline(res.rules);
        setRules(res.rules.map((rule) => ({ ...rule, localId: makeId() })));
        setError(null);
      } else {
        setBaseline(defaultQuotaRules);
        setRules(defaultQuotaRules.map((rule) => ({ ...rule, localId: makeId() })));
        setError(res.error || null);
      }
    } catch (err) {
      setBaseline(defaultQuotaRules);
      setRules(defaultQuotaRules.map((rule) => ({ ...rule, localId: makeId() })));
      setError('Failed to load quota rules');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRules();
  }, []);

  const updateRule = (localId: string, patch: Partial<EditableRule>) => {
    setRules((prev) =>
      prev.map((rule) => (rule.localId === localId ? { ...rule, ...patch } : rule))
    );
  };

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: `custom-${prev.length + 1}`,
        label: 'Custom',
        match: '',
        limitTokens: 100000,
        localId: makeId()
      }
    ]);
  };

  const removeRule = (localId: string) => {
    setRules((prev) => prev.filter((rule) => rule.localId !== localId));
  };

  const resetDefaults = () => {
    setRules(defaultQuotaRules.map((rule) => ({ ...rule, localId: makeId() })));
  };

  const save = async () => {
    try {
      const payload = rules.map(({ localId, ...rest }) => rest);
      const res = await api.saveQuotaRules(payload);
      if (res.success) {
        setBaseline(payload);
        copyFeedback.trigger('Saved');
      } else {
        copyFeedback.trigger(res.error || 'Save failed');
      }
    } catch (err) {
      copyFeedback.trigger('Save failed');
    }
  };

  return (
    <section className="section-card relative grid gap-4">
      <CopyToast message={copyFeedback.message} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Quota Limits</p>
          <h3 className="text-lg font-semibold text-white">Per Model / Provider Tokens</h3>
          <p className="text-xs text-slate-500">
            Rules match when a model name contains the match string (case-insensitive).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetDefaults}
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:text-white"
          >
            Reset defaults
          </button>
          <button
            onClick={save}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-4 py-2 text-xs text-primary transition hover:text-white"
          >
            <Save size={14} /> Save
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {loading && <p className="text-xs text-slate-400">Loading quota rules...</p>}
        {error && !loading && <p className="text-xs text-amber-200">{error}</p>}
        {rules.map((rule) => (
          <div
            key={rule.localId}
            className="grid gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 lg:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
              Label
              <input
                value={rule.label}
                onChange={(event) => updateRule(rule.localId, { label: event.target.value })}
                className="rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
              Match
              <input
                value={rule.match}
                onChange={(event) => updateRule(rule.localId, { match: event.target.value })}
                className="rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
              Limit Tokens
              <input
                type="number"
                min={0}
                value={rule.limitTokens}
                onChange={(event) =>
                  updateRule(rule.localId, { limitTokens: Number(event.target.value) })
                }
                className="rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <button
              onClick={() => removeRule(rule.localId)}
              className="inline-flex items-center justify-center rounded-xl border border-red-500/30 px-3 py-2 text-xs text-red-200 transition hover:text-white"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRule}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:text-white"
      >
        <Plus size={14} /> Add rule
      </button>

      {hasChanges && (
        <p className="text-xs text-amber-200">
          You have unsaved changes. Click Save to apply.
        </p>
      )}
    </section>
  );
}
