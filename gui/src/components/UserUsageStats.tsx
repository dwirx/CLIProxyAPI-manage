import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface UserUsage {
  user: string;
  requests: number;
  totalTokens: number;
  models: number;
  lastActivity: string;
}

export default function UserUsageStats() {
  const [users, setUsers] = useState<UserUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchUserUsage();
  }, [days]);

  const fetchUserUsage = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/users?days=${days}`);
      const data = await response.json();
      if (data.success) {
        setUsers(data.entries || []);
      }
    } catch (error) {
      console.error('Failed to fetch user usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRandomColor = (index: number) => {
    const colors = [
      'hsl(var(--p))',
      'hsl(var(--s))',
      'hsl(var(--a))',
      'hsl(var(--su))',
      'hsl(var(--wa))',
      'hsl(var(--er))',
      'hsl(var(--in))',
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">User Usage Statistics</h2>
          <div className="flex justify-center items-center h-40">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">User Usage Statistics</h2>
            <select
              className="select select-sm select-bordered"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          <div className="text-center text-base-content/60 py-8">
            No user data available for the selected period
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title">User Usage Statistics</h2>
          <select
            className="select select-sm select-bordered"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {/* Chart */}
        <div className="mb-6">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={users}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bc) / 0.1)" />
              <XAxis
                dataKey="user"
                tick={{ fill: 'hsl(var(--bc) / 0.6)', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--bc) / 0.6)', fontSize: 12 }}
                tickFormatter={formatTokens}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--b2))',
                  border: '1px solid hsl(var(--bc) / 0.2)',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ color: 'hsl(var(--bc))' }}
                itemStyle={{ color: 'hsl(var(--bc) / 0.8)' }}
              />
              <Bar dataKey="totalTokens" radius={[8, 8, 0, 0]}>
                {users.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getRandomColor(index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr className="bg-base-300">
                <th className="w-8">#</th>
                <th>User</th>
                <th className="text-right">Requests</th>
                <th className="text-right">Total Tokens</th>
                <th className="text-right">Models Used</th>
                <th>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                  className="hover:bg-base-300/50"
                >
                  <td className="text-base-content/60">{idx + 1}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getRandomColor(idx) }}
                      />
                      <span className="font-medium">{user.user}</span>
                    </div>
                  </td>
                  <td className="text-right font-mono text-sm">
                    {user.requests.toLocaleString()}
                  </td>
                  <td className="text-right font-mono text-sm">
                    {formatTokens(user.totalTokens)}
                  </td>
                  <td className="text-right">
                    <span className="badge badge-sm badge-outline">
                      {user.models} model{user.models > 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="text-xs text-base-content/70">
                    {formatDate(user.lastActivity)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-4 flex justify-around bg-base-300 rounded-lg p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {users.length}
            </div>
            <div className="text-xs text-base-content/60">Active Users</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary">
              {formatTokens(users.reduce((sum, u) => sum + u.totalTokens, 0))}
            </div>
            <div className="text-xs text-base-content/60">Total Tokens</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">
              {users.reduce((sum, u) => sum + u.requests, 0).toLocaleString()}
            </div>
            <div className="text-xs text-base-content/60">Total Requests</div>
          </div>
        </div>
      </div>
    </div>
  );
}
