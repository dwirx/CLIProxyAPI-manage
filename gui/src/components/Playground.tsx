import { Play, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export function Playground() {
  const models = useAppStore((state) => state.models);
  const selectedModel = useAppStore((state) => state.selectedModel);
  const addLog = useAppStore((state) => state.addLog);
  const [model, setModel] = useState(selectedModel || '');
  const [system, setSystem] = useState('');
  const [prompt, setPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);
  const [apiKey, setApiKey] = useState('');
  const [output, setOutput] = useState('Ready.');
  const [loading, setLoading] = useState(false);

  const modelOptions = useMemo(() => models, [models]);

  useEffect(() => {
    if (selectedModel && selectedModel !== model) {
      setModel(selectedModel);
    }
  }, [selectedModel, model]);

  const runPrompt = async () => {
    if (!model) {
      setOutput('Select a model first.');
      return;
    }
    if (!prompt.trim()) {
      setOutput('Prompt is empty.');
      return;
    }

    setLoading(true);
    setOutput('Running...');

    try {
      const data = await api.playground({
        model,
        system,
        prompt,
        temperature,
        maxTokens,
        apiKey
      });
      if (data.success) {
        setOutput(data.response || '(empty response)');
        addLog({
          time: new Date().toLocaleTimeString(),
          message: 'Playground request completed',
          type: 'success'
        });
      } else {
        setOutput(data.error || 'Request failed');
        addLog({
          time: new Date().toLocaleTimeString(),
          message: 'Playground request failed',
          type: 'error'
        });
      }
    } catch (err) {
      setOutput('Request failed');
    }

    setLoading(false);
  };

  const reset = () => {
    setSystem('');
    setPrompt('');
    setOutput('Ready.');
  };

  return (
    <section className="section-card grid gap-5">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Playground</p>
        <h3 className="text-lg font-semibold text-white">Prompt Runner</h3>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-4">
          <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
            Model
            <select
              className="rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              <option value="">Select a model</option>
              {modelOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
            System
            <textarea
              className="min-h-[80px] rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm"
              value={system}
              onChange={(event) => setSystem(event.target.value)}
              placeholder="Optional system prompt"
            />
          </label>
          <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
            User Prompt
            <textarea
              className="min-h-[120px] rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask anything..."
            />
          </label>
        </div>
        <div className="grid gap-4">
          <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
            API Key
            <input
              className="rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Optional, default sk-dummy"
            />
          </label>
          <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
            Temperature
            <input
              type="number"
              step="0.1"
              min={0}
              max={2}
              className="rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm"
              value={temperature}
              onChange={(event) => setTemperature(Number(event.target.value))}
            />
          </label>
          <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
            Max Tokens
            <input
              type="number"
              min={16}
              max={4096}
              className="rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm"
              value={maxTokens}
              onChange={(event) => setMaxTokens(Number(event.target.value))}
            />
          </label>
          <div className="mt-auto flex flex-col gap-2">
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={runPrompt}
              disabled={loading}
            >
              <Play size={16} /> {loading ? 'Running...' : 'Run Prompt'}
            </button>
            <button className="btn btn-outline flex items-center gap-2" onClick={reset}>
              <RotateCcw size={16} /> Clear
            </button>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-base-300/60 p-4 font-mono text-sm text-slate-200">
        {output}
      </div>
    </section>
  );
}
