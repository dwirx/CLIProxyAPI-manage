import { Link } from 'react-router-dom';
import { ModelPicker } from '../components/ModelPicker';
import { Playground } from '../components/Playground';
import { PricingAnalyzer } from '../components/PricingAnalyzer';
import { RecentRequests } from '../components/RecentRequests';
import { UsageAnalytics } from '../components/UsageAnalytics';

export function ApiProxy() {
  return (
    <div className="grid gap-6">
      <section className="section-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Playground</p>
          <h3 className="text-lg font-semibold text-white">Dedicated Prompt Lab</h3>
          <p className="text-sm text-slate-400">Open a focused playground page for experiments.</p>
        </div>
        <Link className="btn btn-primary" to="/playground">
          Open /playground
        </Link>
      </section>
      <ModelPicker />
      <Playground />
      <PricingAnalyzer />
      <UsageAnalytics />
      <RecentRequests />
    </div>
  );
}
