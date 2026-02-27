import { useState, useCallback, useEffect } from 'react';
import i18n from '../i18n';
import { getGoogleTranslateLang, applyGoogleTranslate } from '../utils/googleTranslate';

export function useLanguageSwitch() {
  const [language, setLanguageState] = useState<'en' | 'bg'>(getGoogleTranslateLang());
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const sync = () => {
      const lng = getGoogleTranslateLang();
      setLanguageState(lng);
      if (i18n.language !== lng) i18n.changeLanguage(lng);
    };
    sync();
    const id = setInterval(sync, 500);
    return () => clearInterval(id);
  }, []);

  const setLanguage = useCallback((lng: 'bg' | 'en') => {
    if (lng === language) return;
    setIsTranslating(true);
    setLanguageState(lng);
    i18n.changeLanguage(lng);
    applyGoogleTranslate(lng);
    setTimeout(() => setIsTranslating(false), 600);
  }, [language]);

  return { language, setLanguage, isTranslating, translateError: null };
}
