import { Copy, Eye, Play, RotateCcw, Sparkles } from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { CopyToast } from './CopyToast';
import { useCopyFeedback } from '../lib/useCopyFeedback';

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
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [viewMode, setViewMode] = useState<'raw' | 'preview'>('preview');
  const copyFeedback = useCopyFeedback();

  const modelOptions = useMemo(() => models, [models]);

  useEffect(() => {
    if (selectedModel && selectedModel !== model) {
      setModel(selectedModel);
    }
  }, [selectedModel, model]);

  const runPrompt = async () => {
    if (!model) {
      setOutput('Select a model first.');
      setStatus('error');
      return;
    }
    if (!prompt.trim()) {
      setOutput('Prompt is empty.');
      setStatus('error');
      return;
    }

    setLoading(true);
    setOutput('Running...');
    setStatus('running');

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
        setStatus('success');
        addLog({
          time: new Date().toLocaleTimeString(),
          message: 'Playground request completed',
          type: 'success'
        });
      } else {
        setOutput(data.error || 'Request failed');
        setStatus('error');
        addLog({
          time: new Date().toLocaleTimeString(),
          message: 'Playground request failed',
          type: 'error'
        });
      }
    } catch (err) {
      setOutput('Request failed');
      setStatus('error');
    }

    setLoading(false);
  };

  const reset = () => {
    setSystem('');
    setPrompt('');
    setOutput('Ready.');
    setStatus('idle');
  };

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output);
      copyFeedback.trigger('Copied output');
      addLog({
        time: new Date().toLocaleTimeString(),
        message: 'Playground output copied',
        type: 'success'
      });
    } catch (err) {
      copyFeedback.trigger('Copy failed');
      addLog({
        time: new Date().toLocaleTimeString(),
        message: 'Failed to copy output',
        type: 'warning'
      });
    }
  };

  const applyTemplate = (text: string) => {
    setPrompt(text);
  };

  const outputTone =
    status === 'error'
      ? 'border-red-400/30 bg-red-500/10 text-red-100'
      : status === 'success'
        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
        : 'border-white/10 bg-base-300/60 text-slate-200';

  return (
    <section className="section-card relative grid gap-5">
      <CopyToast message={copyFeedback.message} />
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="uppercase tracking-[0.3em] text-[11px]">Quick Prompts</span>
            {[
              'Summarize this in 5 bullets.',
              'Draft a short email reply.',
              'Explain the main idea simply.'
            ].map((template) => (
              <button
                key={template}
                onClick={() => applyTemplate(template)}
                className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-300 transition hover:text-white"
              >
                <Sparkles size={12} className="mr-1 inline-block" />
                {template}
              </button>
            ))}
          </div>
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
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Response</p>
            <p className="text-sm text-slate-500">
              {status === 'running'
                ? 'Running...'
                : status === 'success'
                  ? 'Completed'
                  : status === 'error'
                    ? 'Needs attention'
                    : 'Idle'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setViewMode('raw')}
              className={`rounded-full border px-4 py-2 text-xs transition ${
                viewMode === 'raw'
                  ? 'border-primary/40 bg-primary/20 text-white'
                  : 'border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              Raw
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs transition ${
                viewMode === 'preview'
                  ? 'border-primary/40 bg-primary/20 text-white'
                  : 'border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              <Eye size={14} /> Preview
            </button>
            <button
              onClick={copyOutput}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-slate-200 transition hover:text-white"
            >
              <Copy size={14} /> Copy response
            </button>
          </div>
        </div>
        {viewMode === 'raw' ? (
          <div className={`rounded-2xl border p-4 font-mono text-sm ${outputTone}`}>{output}</div>
        ) : (
          <div className={`markdown-preview rounded-2xl border p-4 text-sm ${outputTone}`}>
            {renderMarkdown(output)}
          </div>
        )}
      </div>
    </section>
  );
}

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx];

    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      idx += 1;
      while (idx < lines.length && !lines[idx].startsWith('```')) {
        codeLines.push(lines[idx]);
        idx += 1;
      }
      elements.push(
        <pre key={`code-${idx}`}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      idx += 1;
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(<h1 key={`h1-${idx}`}>{renderInline(line.slice(2))}</h1>);
      idx += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={`h2-${idx}`}>{renderInline(line.slice(3))}</h2>);
      idx += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={`h3-${idx}`}>{renderInline(line.slice(4))}</h3>);
      idx += 1;
      continue;
    }

    if (line.match(/^[-*]\s+/)) {
      const items: string[] = [];
      while (idx < lines.length && lines[idx].match(/^[-*]\s+/)) {
        items.push(lines[idx].replace(/^[-*]\s+/, ''));
        idx += 1;
      }
      elements.push(
        <ul key={`ul-${idx}`}>
          {items.map((item, itemIdx) => (
            <li key={`li-${idx}-${itemIdx}`}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (idx < lines.length && lines[idx].match(/^\d+\.\s+/)) {
        items.push(lines[idx].replace(/^\d+\.\s+/, ''));
        idx += 1;
      }
      elements.push(
        <ol key={`ol-${idx}`}>
          {items.map((item, itemIdx) => (
            <li key={`oli-${idx}-${itemIdx}`}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (!line.trim()) {
      elements.push(<div key={`sp-${idx}`} className="h-3" />);
      idx += 1;
      continue;
    }

    elements.push(
      <p key={`p-${idx}`}>
        {renderInline(line)}
      </p>
    );
    idx += 1;
  }

  return <Fragment>{elements}</Fragment>;
}

function renderInline(text: string) {
  const nodes: ReactNode[] = [];
  let i = 0;

  const pushText = (value: string) => {
    if (value) {
      nodes.push(value);
    }
  };

  while (i < text.length) {
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        nodes.push(<strong key={`b-${i}`}>{text.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }

    if (text.startsWith('`', i)) {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        nodes.push(<code key={`c-${i}`}>{text.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    }

    if (text.startsWith('[', i)) {
      const close = text.indexOf(']', i + 1);
      const openParen = text.indexOf('(', close + 1);
      const closeParen = text.indexOf(')', openParen + 1);
      if (close !== -1 && openParen === close + 1 && closeParen !== -1) {
        const label = text.slice(i + 1, close);
        const url = text.slice(openParen + 1, closeParen);
        nodes.push(
          <a key={`a-${i}`} href={url} target="_blank" rel="noreferrer">
            {label}
          </a>
        );
        i = closeParen + 1;
        continue;
      }
    }

    const nextToken = findNextToken(text, i);
    pushText(text.slice(i, nextToken));
    i = nextToken;
  }

  return nodes;
}

function findNextToken(text: string, start: number) {
  const tokens = ['**', '`', '['];
  let next = text.length;
  for (const token of tokens) {
    const idx = text.indexOf(token, start);
    if (idx !== -1 && idx < next) {
      next = idx;
    }
  }
  return next;
}
