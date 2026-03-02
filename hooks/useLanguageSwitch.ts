import { useState, useCallback, useEffect } from 'react';
import i18n from '../i18n';
// Google Translate не се използва – преводът е изцяло чрез i18next

export function useLanguageSwitch() {
  const [language, setLanguageState] = useState<'en' | 'bg'>(
    i18n.language === 'en' ? 'en' : 'bg'
  );

  useEffect(() => {
    const handler = (lng: string) => setLanguageState(lng === 'en' ? 'en' : 'bg');
    i18n.on('languageChanged', handler);
    return () => i18n.off('languageChanged', handler);
  }, []);

  const setLanguage = useCallback((lng: 'bg' | 'en') => {
    i18n.changeLanguage(lng);
  }, []);

  return { language, setLanguage, isTranslating: false, translateError: null };
}
