import { ActivityLog } from '../components/ActivityLog';
import { ApiHealth } from '../components/ApiHealth';
import { StatsChart } from '../components/StatsChart';
import { StatusCard } from '../components/StatusCard';

export function Dashboard() {
  return (
    <div className="grid gap-6">
      <StatusCard />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <StatsChart />
        <ApiHealth />
      </div>
      <ActivityLog />
    </div>
  );
}
