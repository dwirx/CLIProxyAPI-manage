export type Status = {
  running: boolean;
  pid?: number;
  port: number;
  endpoint: string;
  startTime?: string;
};

export type Stats = {
  total: number;
  success: number;
  errors: number;
  successRate: number;
  avgLatency: number;
  lastReset: string;
  available: boolean;
  message?: string;
};

export type ModelsResponse = {
  success: boolean;
  models: string[];
  error?: string;
};

export type ConfigResponse = {
  success: boolean;
  content: string;
  error?: string;
};

export type FactoryConfigResponse = {
  success: boolean;
  models: Array<{ model: string; display_name: string; base_url: string }>;
  error?: string;
};

export type ApiTestResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

export type PlaygroundResponse = {
  success: boolean;
  response?: string;
  error?: string;
};

export type OAuthSession = {
  success: boolean;
  sessionId: string;
  provider: string;
  running: boolean;
  output: string;
  error?: string;
};

export type AnalyticsSummary = {
  success: boolean;
  totals: {
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    avgLatencyMs: number;
    successRate: number;
  };
  perDay: Array<{ date: string; requests: number; tokens: number }>;
  topModels: Array<{ model: string; provider: string; requests: number; tokens: number }>;
  error?: string;
};

export type AnalyticsRecent = {
  success: boolean;
  entries: Array<{
    timestamp: string;
    model: string;
    provider: string;
    totalTokens: number;
    latencyMs: number;
    success: boolean;
    error?: string;
  }>;
  error?: string;
};

const jsonHeaders = { 'Content-Type': 'application/json' };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return res.json();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body)
  });
  return res.json();
}

async function deleteJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' });
  return res.json();
}

export const api = {
  status: () => getJson<Status>('/api/status'),
  authStatus: () => getJson<Record<string, boolean>>('/api/auth-status'),
  models: () => getJson<ModelsResponse>('/api/models'),
  stats: () => getJson<Stats>('/api/stats'),
  start: () => postJson<{ success: boolean; pid?: number; error?: string }>('/api/start', {}),
  stop: () => postJson<{ success: boolean; error?: string }>('/api/stop', {}),
  restart: () => postJson<{ success: boolean; pid?: number; error?: string }>('/api/restart', {}),
  config: () => getJson<ConfigResponse>('/api/config'),
  saveConfig: (content: string) =>
    postJson<{ success: boolean; message?: string; error?: string }>('/api/config', { content }),
  factoryConfig: () => getJson<FactoryConfigResponse>('/api/factory-config'),
  addFactoryModels: (models: string[], displayNames: Record<string, string>) =>
    postJson<{ success: boolean; added?: string[]; error?: string }>('/api/factory-config/add', {
      models,
      displayNames
    }),
  removeFactoryModels: (models: string[], all = false) =>
    postJson<{ success: boolean; removed?: string[]; error?: string }>('/api/factory-config/remove', {
      models,
      all
    }),
  testApi: (apiKey: string) => postJson<ApiTestResponse>('/api/test', { apiKey }),
  analyticsSummary: () => getJson<AnalyticsSummary>('/api/analytics/summary'),
  analyticsRecent: () => getJson<AnalyticsRecent>('/api/analytics/recent'),
  oauthStart: (provider: string) => postJson<OAuthSession>(`/api/oauth/${provider}`, {}),
  oauthStatus: (sessionId: string) => getJson<OAuthSession>(`/api/oauth/session/${sessionId}`),
  oauthInput: (sessionId: string, input: string) =>
    postJson<{ success: boolean; error?: string }>(`/api/oauth/session/${sessionId}`, { input }),
  oauthStop: (sessionId: string) =>
    deleteJson<{ success: boolean; error?: string }>(`/api/oauth/session/${sessionId}`),
  playground: (payload: {
    model: string;
    system: string;
    prompt: string;
    temperature: number;
    maxTokens: number;
    apiKey: string;
  }) => postJson<PlaygroundResponse>('/api/playground', payload)
};
