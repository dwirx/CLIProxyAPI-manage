export type PriceEntry = {
  model: string;
  provider: string;
  inputPer1M: number;
  outputPer1M: number;
};

type CostUnit = '1k' | '1m' | 'token' | 'unknown';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function normalizeCost(value: number, unit: CostUnit): number {
  if (unit === '1k') return value * 1000;
  if (unit === 'token') return value * 1_000_000;
  return value;
}

function detectUnit(key: string): CostUnit {
  const lower = key.toLowerCase();
  if (lower.includes('1k') || lower.includes('per_1k')) return '1k';
  if (lower.includes('1m') || lower.includes('per_1m') || lower.includes('million')) return '1m';
  if (lower.includes('token')) return 'token';
  return 'unknown';
}

function findCost(
  obj: Record<string, unknown>,
  keys: string[]
): { value: number; unit: CostUnit } | null {
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
  const lower = model.toLowerCase();
  if (lower.startsWith('gemini')) return 'Google';
  if (lower.startsWith('claude')) return 'Anthropic';
  if (lower.startsWith('gpt') || lower.startsWith('o1')) return 'OpenAI';
  if (lower.startsWith('qwen')) return 'Qwen';
  if (lower.startsWith('kiro')) return 'Kiro';
  return 'Unknown';
}

export function extractPriceEntries(raw: unknown): PriceEntry[] {
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

    let inputCost: { value: number; unit: CostUnit } | null = null;
    let outputCost: { value: number; unit: CostUnit } | null = null;

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

export function findPriceEntry(entries: PriceEntry[], model: string): PriceEntry | null {
  const target = model.trim().toLowerCase();
  if (!target) return null;
  const exact = entries.find((entry) => entry.model.toLowerCase() === target);
  if (exact) return exact;
  const partial = entries.find(
    (entry) =>
      target.includes(entry.model.toLowerCase()) ||
      entry.model.toLowerCase().includes(target)
  );
  return partial || null;
}
