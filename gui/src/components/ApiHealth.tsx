import { Activity } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export function ApiHealth() {
  const [apiKey, setApiKey] = useState('');
  const [result, setResult] = useState<string>('Not tested yet.');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const addLog = useAppStore((state) => state.addLog);

  const runTest = async () => {
    setResult('Testing...');
    setStatus('idle');
    try {
      const data = await api.testApi(apiKey);
      if (data.success) {
        setResult(data.message || 'API OK');
        setStatus('success');
        addLog({
          time: new Date().toLocaleTimeString(),
          message: 'API health check passed',
          type: 'success'
        });
      } else {
        setResult(data.error || 'API failed');
        setStatus('error');
        addLog({
          time: new Date().toLocaleTimeString(),
          message: 'API health check failed',
          type: 'error'
        });
      }
    } catch (err) {
      setResult('Request failed');
      setStatus('error');
    }
  };

  return (
    <section className="section-card grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">API Health</p>
          <h3 className="text-lg font-semibold text-white">Connectivity Test</h3>
        </div>
        <Activity className="text-primary" size={20} />
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          className="flex-1 rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-sm"
          placeholder="API key (optional, default sk-dummy)"
        />
        <button className="btn btn-outline btn-primary" onClick={runTest}>
          Test API
        </button>
      </div>
      <div
        className={`rounded-xl border border-dashed px-4 py-3 text-sm ${
          status === 'success'
            ? 'border-success/50 text-success'
            : status === 'error'
              ? 'border-error/50 text-error'
              : 'border-white/10 text-slate-400'
        }`}
      >
        {result}
      </div>
    </section>
  );
}
