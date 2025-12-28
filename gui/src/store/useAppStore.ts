import { create } from 'zustand';
import { api, Status, Stats } from '../lib/api';

export type LogEntry = {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
};

type AppState = {
  status: Status | null;
  stats: Stats | null;
  models: string[];
  authStatus: Record<string, boolean>;
  logs: LogEntry[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  refreshStatus: () => Promise<void>;
  refreshStats: () => Promise<void>;
  refreshModels: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  addLog: (entry: Omit<LogEntry, 'id'>) => void;
  clearLogs: () => void;
};

const logId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const useAppStore = create<AppState>((set, get) => ({
  status: null,
  stats: null,
  models: [],
  authStatus: {},
  logs: [],
  selectedModel: localStorage.getItem('selectedModel') || '',
  setSelectedModel: (model) => {
    localStorage.setItem('selectedModel', model);
    set({ selectedModel: model });
  },
  refreshStatus: async () => {
    try {
      const data = await api.status();
      set({ status: data });
    } catch (err) {
      set({ status: null });
    }
  },
  refreshStats: async () => {
    try {
      const data = await api.stats();
      set({ stats: data });
    } catch (err) {
      set({ stats: null });
    }
  },
  refreshModels: async () => {
    try {
      const data = await api.models();
      set({ models: data.models || [] });
    } catch (err) {
      set({ models: [] });
    }
  },
  refreshAuth: async () => {
    try {
      const data = await api.authStatus();
      set({ authStatus: data || {} });
    } catch (err) {
      set({ authStatus: {} });
    }
  },
  addLog: (entry) => {
    const next: LogEntry = { id: logId(), ...entry };
    const logs = [next, ...get().logs].slice(0, 120);
    set({ logs });
  },
  clearLogs: () => set({ logs: [] })
}));
