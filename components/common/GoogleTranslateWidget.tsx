/**
 * Google Website Translator – превежда целия видим интерфейс.
 * НЕ влияе на getApiLang() – API promptовете остават BG/EN според нашия превключвател.
 * Retranslate при динамично съдържание (портали, SPA навигация).
 */
import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const SCRIPT_URL = 'https://translate.google.com/translate_a/element.js';
const CB_NAME = 'googleTranslateElementInit';
const RETRANSLATE_EVENT = 'retranslate';

declare global {
  interface Window {
    google?: {
      translate: {
        TranslateElement: (new (config: object, id: string) => void) & { InlineLayout: { SIMPLE: number } };
      };
    };
    [key: string]: unknown;
  }
}

/** Тригерира повторно превод на динамично съдържание (портали, SPA навигация) */
function retranslate(): void {
  const cookie = document.cookie.split(';').find((c) => c.trim().startsWith('googtrans='));
  const val = cookie?.split('=')[1]?.trim();
  if (!val || val === '/bg/bg') return; // не е активен превод
  const target = val.split('/').filter(Boolean).pop();
  const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (!select || !target) return;
  // Форсираме re-translation: временно сменяме и връщаме, за да засече ново съдържание
  const orig = select.value;
  select.value = orig === target ? '' : target;
  if (select.value === '') select.value = target;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

const GoogleTranslateWidget: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const location = useLocation();

  useEffect(() => {
    if (loadedRef.current || typeof window === 'undefined') return;
    if (document.querySelector(`script[src="${SCRIPT_URL}"]`)) return;

    (window as Record<string, () => void>)[CB_NAME] = () => {
      if (window.google?.translate?.TranslateElement) {
        const Te = window.google.translate.TranslateElement as { new (c: object, id: string): void; InlineLayout?: { SIMPLE: number } };
        new Te(
          {
            pageLanguage: 'bg',
            includedLanguages: 'en',
            layout: Te.InlineLayout?.SIMPLE ?? 0,
            autoDisplay: false,
          },
          'google_translate_element'
        );
      }
    };

    const script = document.createElement('script');
    script.src = `${SCRIPT_URL}?cb=${CB_NAME}`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    loadedRef.current = true;

    return () => {
      delete (window as Record<string, unknown>)[CB_NAME];
    };
  }, []);

  // Retranslate при SPA навигация
  useEffect(() => {
    const t = setTimeout(retranslate, 400);
    return () => clearTimeout(t);
  }, [location.pathname]);

  // Retranslate при custom event (напр. отваряне на dropdown)
  useEffect(() => {
    const handler = () => setTimeout(retranslate, 100);
    window.addEventListener(RETRANSLATE_EVENT, handler);
    return () => window.removeEventListener(RETRANSLATE_EVENT, handler);
  }, []);

  return (
    <>
      <div ref={containerRef} id="google_translate_element" className="inline-block [&_.goog-te-gadget]:!text-[9px] [&_.goog-te-gadget]:!font-bold [&_.goog-te-gadget]:!text-[#888]" />
      <style>{`
        .goog-te-banner-frame { display: none !important; }
        #goog-gt-tt, .goog-te-balloon-frame { display: none !important; }
        body { top: 0 !important; }
        .goog-te-gadget-simple { background: transparent !important; border: 1px solid #333 !important; padding: 4px 8px !important; border-radius: 4px !important; }
        .goog-te-gadget-simple .goog-te-menu-value span { color: #C4B091 !important; }
        .goog-te-gadget-simple .goog-te-menu-value span:first-child { color: #666 !important; }
        .goog-te-gadget-icon { display: none !important; }
      `}</style>
    </>
  );
};

export default GoogleTranslateWidget;
