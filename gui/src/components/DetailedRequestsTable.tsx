import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface DetailedRequest {
  timestamp: string;
  model: string;
  provider: string;
  user?: string;
  accountId?: string;
  totalTokens: number;
  cost?: string;
  latencyMs: number;
  success: boolean;
  type?: string;
  error?: string;
}

export default function DetailedRequestsTable() {
  const [requests, setRequests] = useState<DetailedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchRequests();
  }, [limit]);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`/api/analytics/recent?limit=${limit}`);
      const data = await response.json();
      if (data.success) {
        setRequests(data.entries || []);
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
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

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const getTypeStyle = (type?: string, success?: boolean) => {
    if (!success) return 'badge-error';
    if (type === 'Free' || type?.includes('Free')) return 'badge-info';
    if (type?.includes('Aborted')) return 'badge-warning';
    return 'badge-success';
  };

  const getTypeText = (type?: string, success?: boolean) => {
    if (!success) return 'Failed';
    if (!type) return 'Included';
    return type;
  };

  if (loading) {
    return (
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Detailed Request History</h2>
          <div className="flex justify-center items-center h-40">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title">Detailed Request History</h2>
          <div className="flex gap-2">
            <select
              className="select select-sm select-bordered"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={25}>25 requests</option>
              <option value={50}>50 requests</option>
              <option value={100}>100 requests</option>
              <option value={200}>200 requests</option>
            </select>
            <button
              className="btn btn-sm btn-primary"
              onClick={fetchRequests}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-xs table-pin-rows">
            <thead>
              <tr className="bg-base-300">
                <th className="w-32">Date</th>
                <th className="w-24">Type</th>
                <th className="w-48">Model</th>
                <th className="w-32">Provider</th>
                <th className="w-32">User</th>
                <th className="w-24 text-right">Tokens</th>
                <th className="w-24 text-right">Cost</th>
                <th className="w-20 text-right">Latency</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-base-content/60 py-8">
                    No requests found
                  </td>
                </tr>
              ) : (
                requests.map((req, idx) => (
                  <motion.tr
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02, duration: 0.2 }}
                    className="hover:bg-base-300/50"
                  >
                    <td className="text-xs text-base-content/70">
                      {formatDate(req.timestamp)}
                    </td>
                    <td>
                      <span className={`badge badge-sm ${getTypeStyle(req.type, req.success)}`}>
                        {getTypeText(req.type, req.success)}
                      </span>
                    </td>
                    <td className="font-mono text-xs">
                      <div className="truncate max-w-xs" title={req.model}>
                        {req.model}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-sm badge-outline">
                        {req.provider}
                      </span>
                    </td>
                    <td className="text-xs">
                      <div className="truncate max-w-xs" title={req.user || 'Unknown'}>
                        {req.user || <span className="text-base-content/40">Unknown</span>}
                      </div>
                    </td>
                    <td className="text-right font-mono text-xs">
                      {formatTokens(req.totalTokens)}
                    </td>
                    <td className="text-right font-mono text-xs">
                      {req.cost || <span className="text-base-content/40">—</span>}
                    </td>
                    <td className="text-right text-xs text-base-content/70">
                      {req.latencyMs > 0 ? `${(req.latencyMs / 1000).toFixed(2)}s` : '—'}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {requests.length > 0 && (
          <div className="mt-4 text-sm text-base-content/60 text-center">
            Showing {requests.length} most recent requests
          </div>
        )}
      </div>
    </div>
  );
}
