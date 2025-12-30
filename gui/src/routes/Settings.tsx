import { CliIntegrations } from '../components/CliIntegrations';
import { ConfigEditor } from '../components/ConfigEditor';
import { QuotaLimits } from '../components/QuotaLimits';

export function Settings() {
  return (
    <div className="grid gap-6">
      <section className="section-card grid gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Database</p>
          <h3 className="text-lg font-semibold text-white">Analytics Storage</h3>
        </div>
        <p className="text-sm text-slate-400">
          Logs and analytics are saved automatically to:
          <span className="ml-2 rounded bg-base-300/60 px-2 py-1 font-mono text-xs text-slate-200">
            ~/.cli-proxy-api/dataproxy.db
          </span>
        </p>
        <p className="text-xs text-slate-500">
          The database is created automatically when the first request is logged.
        </p>
      </section>
      <CliIntegrations />
      <QuotaLimits />
      <ConfigEditor />
    </div>
  );
}
