import { useState, useCallback, useEffect } from 'react';
import i18n, { restoreEnBundleFromCache } from '../i18n';

const CACHE_KEY = 'i18n_cache_en';
const CACHE_VERSION_KEY = 'i18n_cache_en_version';
const CACHE_VERSION = '1';

/** User-friendly message when translation API is not configured (503) */
export const TRANSLATE_NOT_CONFIGURED_MSG =
  'Преводът не е наличен: на сървъра липсва GOOGLE_TRANSLATE_API_KEY. Добавете го в .env за превод на ENG.';

/** Нормализиран език само 'en' или 'bg' за съвпадение с бутона и кеша */
function currentLng(): 'en' | 'bg' {
  const l = i18n.language;
  return l === 'en' || (l && l.startsWith('en')) ? 'en' : 'bg';
}

export function useLanguageSwitch() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [language, setLanguageState] = useState<'en' | 'bg'>(currentLng());

  useEffect(() => {
    const update = () => setLanguageState(currentLng());
    i18n.on('languageChanged', update);
    return () => i18n.off('languageChanged', update);
  }, []);

  const setLanguage = useCallback(async (lng: string) => {
    setTranslateError(null);
    if (lng === language) return;
    if (lng === 'bg') {
      i18n.changeLanguage('bg');
      return;
    }
    if (lng === 'en') {
      if (i18n.hasResourceBundle('en', 'translation')) {
        i18n.changeLanguage('en');
        return;
      }
      if (restoreEnBundleFromCache()) {
        i18n.changeLanguage('en');
        return;
      }
      setIsTranslating(true);
      try {
        const res = await fetch('/api/translate?target=en');
        const body = await res.text();
        if (!res.ok) {
          let msg = TRANSLATE_NOT_CONFIGURED_MSG;
          if (res.status === 503) {
            try {
              const j = JSON.parse(body);
              if (j?.error) msg = j.error;
            } catch {
              /* use default */
            }
          }
          setTranslateError(msg);
          return;
        }
        const data = JSON.parse(body);
        i18n.addResourceBundle('en', 'translation', data);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
        }
        i18n.changeLanguage('en');
      } catch (e) {
        console.error('[i18n] Failed to load en:', e);
        setTranslateError(TRANSLATE_NOT_CONFIGURED_MSG);
      } finally {
        setIsTranslating(false);
      }
    }
  }, [language]);

  return { language, setLanguage, isTranslating, translateError };
}
