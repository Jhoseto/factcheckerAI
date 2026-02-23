import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiLang } from '../i18n';

const CACHE_PREFIX = 'report_t_';

function getCacheKey(analysisId: string, lang: string): string {
  return `${CACHE_PREFIX}${analysisId}_${lang}`;
}

/**
 * Връща текста на доклада в текущия език на UI. При избран ENG превежда в реално време
 * чрез /api/translate-text и кешира по analysisId.
 */
export function useTranslatedReport(analysisId: string | undefined, reportText: string): { displayText: string; loading: boolean } {
  useTranslation(); // re-render on language change
  const lang = getApiLang();
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cacheKey = useMemo(() => (analysisId && lang === 'en' ? getCacheKey(analysisId, 'en') : null), [analysisId, lang]);

  useEffect(() => {
    if (!reportText?.trim()) {
      setTranslated(null);
      return;
    }
    if (lang !== 'en') {
      setTranslated(null);
      return;
    }
    const key = cacheKey;
    if (!key) {
      setTranslated(null);
      return;
    }
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        setTranslated(cached);
        return;
      }
    } catch {
      /* ignore */
    }
    setLoading(true);
    fetch('/api/translate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: reportText, target: 'en' }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Translate failed'))))
      .then((data) => {
        const text = data.translatedText ?? reportText;
        setTranslated(text);
        try {
          localStorage.setItem(key, text);
        } catch {
          /* ignore */
        }
      })
      .catch(() => setTranslated(reportText))
      .finally(() => setLoading(false));
  }, [reportText, lang, cacheKey]);

  if (lang !== 'en' || !reportText?.trim()) {
    return { displayText: reportText || '', loading: false };
  }
  if (loading && !translated) {
    return { displayText: reportText, loading: true };
  }
  return { displayText: translated ?? reportText, loading: false };
}
