import { Copy, Filter, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export function ModelPicker() {
  const models = useAppStore((state) => state.models);
  const selectedModel = useAppStore((state) => state.selectedModel);
  const setSelectedModel = useAppStore((state) => state.setSelectedModel);
  const addLog = useAppStore((state) => state.addLog);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(
    () => models.filter((model) => model.toLowerCase().includes(filter.toLowerCase())),
    [models, filter]
  );

  const copyModel = async () => {
    if (!selectedModel) return;
    await navigator.clipboard.writeText(selectedModel);
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `Copied model ${selectedModel}`,
      type: 'success'
    });
  };

  return (
    <section className="section-card grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Models</p>
        <h3 className="text-lg font-semibold text-white">Available Models</h3>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="badge-soft">{models.length} total</div>
        {selectedModel && <div className="badge badge-success">Selected: {selectedModel}</div>}
      </div>
      <div className="grid gap-3 md:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-base-200/60 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter size={14} /> Filter
          </div>
          <input
            className="mt-2 w-full rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm"
            placeholder="Search models..."
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <div className="scrollbar-thin mt-4 max-h-52 space-y-2 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400">No models found.</p>
            ) : (
              filtered.map((model) => (
                <button
                  key={model}
                  onClick={() => setSelectedModel(model)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                    model === selectedModel
                      ? 'border-primary/60 bg-primary/10 text-white'
                      : 'border-white/10 bg-base-300/40 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <span className="truncate font-mono text-xs">{model}</span>
                  {model === selectedModel && <Sparkles size={14} className="text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-base-200/60 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Quick Actions</p>
          <div className="mt-3 flex flex-col gap-3">
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={copyModel}
              disabled={!selectedModel}
            >
              <Copy size={16} /> Copy Model ID
            </button>
            <div className="text-xs text-slate-400">
              Use this model ID in your client config or Playground.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
