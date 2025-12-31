import UsageHeatmap from '../components/UsageHeatmap';
import UserUsageStats from '../components/UserUsageStats';
import DetailedRequestsTable from '../components/DetailedRequestsTable';
import { UsageAnalytics } from '../components/UsageAnalytics';

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-base-content/60">
          Comprehensive overview of your API usage, user activity, and request history
        </p>
      </div>

      {/* Usage Overview */}
      <UsageAnalytics />

      {/* Activity Heatmap */}
      <UsageHeatmap />

      {/* User Usage Statistics */}
      <UserUsageStats />

      {/* Detailed Requests Table */}
      <DetailedRequestsTable />
    </div>
  );
}
