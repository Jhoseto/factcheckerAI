/**
 * Google Translate – cookie + trigger за моментален превод на цялата страница.
 * Синхронизира се с бутоните BG/ENG в Navbar.
 */

const COOKIE_NAME = 'googtrans';
const COOKIE_PATH = 'path=/';

export function getGoogleTranslateLang(): 'bg' | 'en' {
  if (typeof document === 'undefined') return 'bg';
  const m = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const val = m?.[1]?.trim();
  if (!val || val === '/bg/bg') return 'bg';
  const target = val.split('/').filter(Boolean).pop();
  return target === 'en' ? 'en' : 'bg';
}

export function setGoogleTranslateCookie(lng: 'bg' | 'en'): void {
  if (typeof document === 'undefined') return;
  if (lng === 'bg') {
    document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; ${COOKIE_PATH}`;
  } else {
    document.cookie = `${COOKIE_NAME}=/bg/en; ${COOKIE_PATH}`;
  }
}

/** Тригерира превод чрез .goog-te-combo. Връща true ако успее, иначе false (reload fallback). */
function triggerSelect(lng: 'bg' | 'en'): boolean {
  const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (!select) return false;
  const target = lng === 'en' ? 'en' : '';
  select.value = target;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/** Тригерира превод чрез select; при неуспех – retry до 3s. */
export function applyGoogleTranslate(lng: 'bg' | 'en'): void {
  setGoogleTranslateCookie(lng);
  function tryTrigger(attempt: number): void {
    if (triggerSelect(lng)) return;
    if (attempt < 14) setTimeout(() => tryTrigger(attempt + 1), 200);
  }
  tryTrigger(0);
}
