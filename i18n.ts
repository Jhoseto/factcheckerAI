import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import bg from './locales/bg.json';
import en from './locales/en.json';

export const STORAGE_KEY = 'i18nextLng';
export const CACHE_KEY = 'i18n_cache_en';
export const CACHE_VERSION_KEY = 'i18n_cache_en_version';
export const CACHE_VERSION = '2';

/** Нормализира записания език само до 'en' или 'bg' */
function getStoredLanguage(): 'en' | 'bg' {
  if (typeof localStorage === 'undefined') return 'bg';
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'en' || (v && v.startsWith('en'))) return 'en';
  return 'bg';
}

/** Cached/API as base, static EN overwrites (nav.logout = "Log out" etc. always win). */
export function mergeEnBundle(data: Record<string, unknown>): Record<string, unknown> {
  function merge(base: unknown, over: unknown): unknown {
    if (over == null) return base;
    if (base != null && typeof base === 'object' && !Array.isArray(base) && typeof over === 'object' && !Array.isArray(over)) {
      const b = base as Record<string, unknown>;
      const o = over as Record<string, unknown>;
      const out: Record<string, unknown> = { ...b };
      for (const k of Object.keys(o)) {
        out[k] = merge(b[k], o[k]);
      }
      return out;
    }
    return over;
  }
  return merge(data, en) as Record<string, unknown>;
}

/** Възстановява EN bundle от localStorage кеш. Връща true ако успее. */
export function restoreEnBundleFromCache(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const version = localStorage.getItem(CACHE_VERSION_KEY);
    if (!cached || version !== CACHE_VERSION) return false;
    const data = JSON.parse(cached) as Record<string, unknown>;
    i18n.addResourceBundle('en', 'translation', mergeEnBundle(data));
    return true;
  } catch {
    return false;
  }
}

const initialLng = getStoredLanguage();

i18n.use(initReactI18next).init({
  resources: { bg: { translation: bg }, en: { translation: en } },
  lng: initialLng,
  fallbackLng: 'bg',
  supportedLngs: ['bg', 'en'],
  interpolation: { escapeValue: false },
});

// Веднага при зареждане: ако е избран EN, възстановяваме кеша (ако има). При липса на кеш — оставаме с static en.json.
if (initialLng === 'en') {
  restoreEnBundleFromCache();
}

// Записваме винаги само 'en' или 'bg', за да няма несъответствие с bundle
i18n.on('languageChanged', (lng: string) => {
  if (typeof localStorage !== 'undefined') {
    const toSave = lng === 'en' || lng.startsWith('en') ? 'en' : 'bg';
    localStorage.setItem(STORAGE_KEY, toSave);
  }
});

/**
 * Текущ език за API заявки (Gemini, превод): винаги 'en' или 'bg'.
 * Контролира се САМО от нашия BG/ENG превключвател в Navbar/Profile.
 * Google Translate widget превежда само визуалния интерфейс – НЕ влияе на getApiLang().
 */
export function getApiLang(): 'en' | 'bg' {
  const l = i18n.language;
  return l === 'en' || (l && String(l).startsWith('en')) ? 'en' : 'bg';
}

export default i18n;
