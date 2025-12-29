import { Link } from 'react-router-dom';
import { Playground } from '../components/Playground';

export function PlaygroundFull() {
  return (
    <div className="grid gap-6">
      <section className="section-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Playground</p>
          <h3 className="text-lg font-semibold text-white">Focused Prompt Lab</h3>
          <p className="text-sm text-slate-400">Run experiments and review the output history below.</p>
        </div>
        <Link className="btn btn-outline" to="/proxy">
          Back to API Proxy
        </Link>
      </section>
      <Playground />
    </div>
  );
}
