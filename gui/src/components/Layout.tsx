import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gauge, Layers, Settings, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

const tabs = [
  { to: '/', labelKey: 'tabs.dashboard', icon: Gauge },
  { to: '/accounts', labelKey: 'tabs.accounts', icon: Users },
  { to: '/proxy', labelKey: 'tabs.proxy', icon: Layers },
  { to: '/settings', labelKey: 'tabs.settings', icon: Settings }
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const refreshStatus = useAppStore((state) => state.refreshStatus);
  const refreshStats = useAppStore((state) => state.refreshStats);
  const refreshAuth = useAppStore((state) => state.refreshAuth);
  const refreshModels = useAppStore((state) => state.refreshModels);

  useEffect(() => {
    refreshStatus();
    refreshStats();
    refreshAuth();
    refreshModels();
    const statusTimer = setInterval(refreshStatus, 5000);
    const statsTimer = setInterval(refreshStats, 10000);
    const authTimer = setInterval(refreshAuth, 12000);
    const modelsTimer = setInterval(refreshModels, 15000);
    return () => {
      clearInterval(statusTimer);
      clearInterval(statsTimer);
      clearInterval(authTimer);
      clearInterval(modelsTimer);
    };
  }, [refreshStatus, refreshStats, refreshAuth, refreshModels]);

  return (
    <div className="app-shell">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 pb-12 pt-8">
        <header className="glass-panel flex flex-col gap-6 rounded-3xl px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">CLI Proxy</p>
              <h1 className="text-2xl font-semibold text-white">{t('title')}</h1>
            </div>
            <div className="badge-soft">Local Control + Multi-Provider Routing</div>
          </div>
          <nav className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm transition',
                      isActive
                        ? 'bg-primary/20 text-white'
                        : 'text-slate-300 hover:border-white/20 hover:text-white'
                    )
                  }
                  end={tab.to === '/'}
                >
                  <Icon size={16} />
                  {t(tab.labelKey)}
                </NavLink>
              );
            })}
          </nav>
        </header>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid gap-6"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
