import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import bg from './locales/bg.json';
import en from './locales/en.json';

const STORAGE_KEY = 'app_language';

const savedLang = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || 'bg';

i18n.use(initReactI18next).init({
  resources: {
    bg: { translation: bg },
    en: { translation: en },
  },
  lng: savedLang === 'en' ? 'en' : 'bg',
  fallbackLng: 'bg',
  supportedLngs: ['bg', 'en'],
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lng);
  }
});

export function getApiLang(): 'en' | 'bg' {
  return i18n.language === 'en' ? 'en' : 'bg';
}

export default i18n;
