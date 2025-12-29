import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

type PriceEntry = {
  model: string;
  provider: string;
  inputPer1M: number;
  outputPer1M: number;
};

type PriceState = {
  loading: boolean;
  error: string | null;
  entries: PriceEntry[];
};

const PRICE_URL = '/api/pricing';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function normalizeCost(value: number, unit: '1k' | '1m' | 'token' | 'unknown'): number {
  if (unit === '1k') return value * 1000;
  if (unit === 'token') return value * 1_000_000;
  return value;
}

function detectUnit(key: string): '1k' | '1m' | 'token' | 'unknown' {
  const lower = key.toLowerCase();
  if (lower.includes('1k') || lower.includes('per_1k')) return '1k';
  if (lower.includes('1m') || lower.includes('per_1m') || lower.includes('million')) return '1m';
  if (lower.includes('token')) return 'token';
  return 'unknown';
}

function findCost(obj: Record<string, unknown>, keys: string[]): { value: number; unit: '1k' | '1m' | 'token' | 'unknown' } | null {
  for (const key of keys) {
    if (key in obj) {
      const num = toNumber(obj[key]);
      if (num !== null) {
        return { value: num, unit: detectUnit(key) };
      }
    }
  }
  return null;
}

function resolveProvider(model: string, provider?: string): string {
  if (provider) return provider;
  if (model.startsWith('gemini')) return 'Google';
  if (model.startsWith('claude')) return 'Anthropic';
  if (model.startsWith('gpt') || model.startsWith('o1')) return 'OpenAI';
  if (model.startsWith('qwen')) return 'Qwen';
  if (model.startsWith('kiro')) return 'Kiro';
  return 'Unknown';
}

function extractPriceEntries(raw: unknown): PriceEntry[] {
  const list: Array<Record<string, unknown>> = [];

  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      if (item && typeof item === 'object') {
        list.push(item as Record<string, unknown>);
      }
    });
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.models)) {
      obj.models.forEach((item) => {
        if (item && typeof item === 'object') list.push(item as Record<string, unknown>);
      });
    } else if (Array.isArray(obj.data)) {
      obj.data.forEach((item) => {
        if (item && typeof item === 'object') list.push(item as Record<string, unknown>);
      });
    } else if (obj.models && typeof obj.models === 'object') {
      Object.entries(obj.models as Record<string, unknown>).forEach(([key, value]) => {
        if (value && typeof value === 'object') {
          list.push({ ...(value as Record<string, unknown>), model: (value as Record<string, unknown>).model ?? key });
        }
      });
    }
  }

  const entries: PriceEntry[] = [];
  for (const item of list) {
    const model =
      (item.model as string) ||
      (item.id as string) ||
      (item.name as string) ||
      (item.model_id as string) ||
      (item.slug as string);

    if (!model) continue;

    const provider =
      (item.provider as string) ||
      (item.vendor as string) ||
      (item.company as string) ||
      (item.source as string);

    const sources = [
      item,
      (item.pricing as Record<string, unknown>) || {},
      (item.prices as Record<string, unknown>) || {},
      (item.costs as Record<string, unknown>) || {}
    ];

    const inputKeys = [
      'input_cost_per_1m',
      'input_cost_per_1k',
      'input_cost_per_token',
      'prompt_cost_per_1m',
      'prompt_cost_per_1k',
      'prompt_cost',
      'input_cost',
      'input',
      'prompt'
    ];

    const outputKeys = [
      'output_cost_per_1m',
      'output_cost_per_1k',
      'output_cost_per_token',
      'completion_cost_per_1m',
      'completion_cost_per_1k',
      'completion_cost',
      'output_cost',
      'output',
      'completion'
    ];

    let inputCost: { value: number; unit: '1k' | '1m' | 'token' | 'unknown' } | null = null;
    let outputCost: { value: number; unit: '1k' | '1m' | 'token' | 'unknown' } | null = null;

    for (const source of sources) {
      inputCost = inputCost ?? findCost(source, inputKeys);
      outputCost = outputCost ?? findCost(source, outputKeys);
    }

    if (!inputCost && !outputCost) continue;

    const inputPer1M = inputCost ? normalizeCost(inputCost.value, inputCost.unit) : 0;
    const outputPer1M = outputCost ? normalizeCost(outputCost.value, outputCost.unit) : 0;

    entries.push({
      model,
      provider: resolveProvider(model, provider),
      inputPer1M,
      outputPer1M
    });
  }

  return entries.sort((a, b) => a.model.localeCompare(b.model));
}

export function PricingAnalyzer() {
  const [state, setState] = useState<PriceState>({
    loading: true,
    error: null,
    entries: []
  });
  const [model, setModel] = useState('');
  const [promptTokens, setPromptTokens] = useState(1000);
  const [completionTokens, setCompletionTokens] = useState(600);
  const [monthlyBudget, setMonthlyBudget] = useState(20);
  const [tokenQuota, setTokenQuota] = useState(250000);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch(PRICE_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const entries = extractPriceEntries(data);
        setState({ loading: false, error: null, entries });
        if (entries.length > 0) {
          setModel(entries[0].model);
        }
      } catch (err) {
        setState({
          loading: false,
          error: 'Failed to load pricing data. Check your network or API server connectivity.',
          entries: []
        });
      }
    };

    fetchPrices();
  }, []);

  const selected = useMemo(
    () => state.entries.find((entry) => entry.model === model),
    [state.entries, model]
  );

  const cost = useMemo(() => {
    if (!selected) return { input: 0, output: 0, total: 0 };
    const input = (promptTokens / 1_000_000) * selected.inputPer1M;
    const output = (completionTokens / 1_000_000) * selected.outputPer1M;
    return { input, output, total: input + output };
  }, [selected, promptTokens, completionTokens]);

  const budgetUsage = useMemo(() => {
    if (!monthlyBudget) return 0;
    return Math.min(100, (cost.total / monthlyBudget) * 100);
  }, [cost.total, monthlyBudget]);

  const tokenUsage = useMemo(() => {
    if (!tokenQuota) return 0;
    const used = promptTokens + completionTokens;
    return Math.min(100, (used / tokenQuota) * 100);
  }, [promptTokens, completionTokens, tokenQuota]);

  const cheapest = useMemo(() => {
    const tokens = promptTokens + completionTokens;
    if (tokens === 0) return [];
    return state.entries
      .filter((entry) => entry.inputPer1M || entry.outputPer1M)
      .map((entry) => {
        const total = (promptTokens / 1_000_000) * entry.inputPer1M +
          (completionTokens / 1_000_000) * entry.outputPer1M;
        return { model: entry.model, provider: entry.provider, total };
      })
      .sort((a, b) => a.total - b.total)
      .slice(0, 5);
  }, [state.entries, promptTokens, completionTokens]);

  return (
    <section className="section-card grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Token Cost</p>
          <h3 className="text-lg font-semibold text-white">Pricing & Quota Analyzer</h3>
        </div>
        <BarChart3 className="text-primary" size={20} />
      </div>

      {state.loading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="animate-spin" size={16} /> Loading pricing data...
        </div>
      ) : state.error ? (
        <div className="rounded-2xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {state.error}
        </div>
      ) : state.entries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-base-300/50 p-4 text-sm text-slate-400">
          Pricing data is not available yet. Check API connectivity or try again later.
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
            <div className="grid gap-3">
              <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                Model
                <select
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm"
                >
                  {state.entries.map((entry) => (
                    <option key={entry.model} value={entry.model}>
                      {entry.model}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                  Prompt tokens
                  <input
                    type="number"
                    min={0}
                    value={promptTokens}
                    onChange={(event) => setPromptTokens(Number(event.target.value))}
                    className="rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                  Completion tokens
                  <input
                    type="number"
                    min={0}
                    value={completionTokens}
                    onChange={(event) => setCompletionTokens(Number(event.target.value))}
                    className="rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-base-300/50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Estimate</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Provider</span>
                  <span className="font-semibold text-white">{selected?.provider || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Input cost</span>
                  <span>${cost.input.toFixed(4)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Output cost</span>
                  <span>${cost.output.toFixed(4)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-semibold text-white">
                  <span>Total</span>
                  <span>${cost.total.toFixed(4)}</span>
                </div>
                <p className="text-xs text-slate-500">Prices normalized to per 1M tokens.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-base-300/50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Budget</p>
              <div className="mt-3 grid gap-2">
                <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Monthly budget (USD)
                </label>
                <input
                  type="number"
                  min={1}
                  value={monthlyBudget}
                  onChange={(event) => setMonthlyBudget(Number(event.target.value))}
                  className="rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm"
                />
                <div className="mt-2 h-2 w-full rounded-full bg-base-200">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${budgetUsage}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">Usage: {budgetUsage.toFixed(1)}%</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-base-300/50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Token quota</p>
              <div className="mt-3 grid gap-2">
                <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Token quota (total)
                </label>
                <input
                  type="number"
                  min={1}
                  value={tokenQuota}
                  onChange={(event) => setTokenQuota(Number(event.target.value))}
                  className="rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm"
                />
                <div className="mt-2 h-2 w-full rounded-full bg-base-200">
                  <div
                    className={cn('h-2 rounded-full', tokenUsage > 80 ? 'bg-error' : 'bg-secondary')}
                    style={{ width: `${tokenUsage}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">Usage: {tokenUsage.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-base-300/50 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cheapest options</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              {cheapest.length === 0 ? (
                <p className="text-slate-400">No price data available for suggestions.</p>
              ) : (
                cheapest.map((entry) => (
                  <div key={entry.model} className="flex items-center justify-between">
                    <span className="truncate">{entry.model}</span>
                    <span className="text-white">${entry.total.toFixed(4)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
