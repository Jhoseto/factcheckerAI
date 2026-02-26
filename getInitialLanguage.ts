/**
 * Geo-based initial language: Bulgaria = bg, rest of world = en.
 * Used only when no language is stored (first visit).
 */

import { STORAGE_KEY } from './i18n';

const GEO_URL = 'https://ip-api.com/json/?fields=countryCode';
const GEO_TIMEOUT_MS = 5000;

/** Fetch country code by IP (e.g. "BG", "US"). Returns "" on error/timeout. */
export async function getGeoCountry(): Promise<string> {
  if (typeof fetch === 'undefined') return '';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), GEO_TIMEOUT_MS);
    const res = await fetch(GEO_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return '';
    const data = await res.json();
    return (data?.countryCode && String(data.countryCode).toUpperCase()) || '';
  } catch {
    return '';
  }
}

/** Fallback when geo fails: use browser language. */
function getFallbackFromNavigator(): 'bg' | 'en' {
  if (typeof navigator === 'undefined' || !navigator.language) return 'bg';
  const lang = navigator.language.toLowerCase();
  if (lang === 'bg' || lang.startsWith('bg-')) return 'bg';
  return 'en';
}

/**
 * Returns initial language for first-time visitors:
 * - If localStorage has i18nextLng → that language (no fetch).
 * - Otherwise: geo → BG = bg, else en; on geo error → navigator.language or 'bg'.
 */
export async function getInitialLanguage(): Promise<'bg' | 'en'> {
  if (typeof localStorage === 'undefined') return 'bg';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || (stored && stored.startsWith('en'))) return 'en';
  if (stored === 'bg') return 'bg';

  const country = await getGeoCountry();
  if (country === 'BG') return 'bg';
  if (country) return 'en';
  return getFallbackFromNavigator();
}
