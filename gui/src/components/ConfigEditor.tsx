import { Save, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export function ConfigEditor() {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const addLog = useAppStore((state) => state.addLog);

  const load = async () => {
    setStatus('Loading...');
    const data = await api.config();
    if (data.success) {
      setContent(data.content);
      setStatus('Loaded');
    } else {
      setStatus(data.error || 'Failed to load');
    }
  };

  const save = async () => {
    setStatus('Saving...');
    const data = await api.saveConfig(content);
    if (data.success) {
      setStatus('Saved');
      addLog({
        time: new Date().toLocaleTimeString(),
        message: 'Config saved',
        type: 'success'
      });
    } else {
      setStatus(data.error || 'Failed to save');
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="section-card grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Configuration</p>
        <h3 className="text-lg font-semibold text-white">config.yaml</h3>
      </div>
      <textarea
        className="min-h-[300px] rounded-2xl border border-white/10 bg-base-300/60 px-4 py-3 font-mono text-xs text-slate-200"
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-slate-400">{status}</span>
        <div className="flex gap-2">
          <button className="btn btn-outline flex items-center gap-2" onClick={load}>
            <RotateCcw size={16} /> Reload
          </button>
          <button className="btn btn-primary flex items-center gap-2" onClick={save}>
            <Save size={16} /> Save
          </button>
        </div>
      </div>
    </section>
  );
}
