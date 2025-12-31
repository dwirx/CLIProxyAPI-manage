import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      title: 'CLIProxyAPI+ Control Center',
      tabs: {
        dashboard: 'Dashboard',
        accounts: 'Accounts',
        proxy: 'API Proxy',
        analytics: 'Analytics',
        settings: 'Settings'
      }
    }
  },
  id: {
    translation: {
      title: 'CLIProxyAPI+ Control Center',
      tabs: {
        dashboard: 'Dashboard',
        accounts: 'Akun',
        proxy: 'API Proxy',
        analytics: 'Analitik',
        settings: 'Pengaturan'
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });

export default i18n;
