import { ModelPicker } from '../components/ModelPicker';
import { Playground } from '../components/Playground';
import { PricingAnalyzer } from '../components/PricingAnalyzer';

export function ApiProxy() {
  return (
    <div className="grid gap-6">
      <ModelPicker />
      <Playground />
      <PricingAnalyzer />
    </div>
  );
}
