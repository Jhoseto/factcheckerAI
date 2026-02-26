import './i18n';
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { HelmetProvider } from 'react-helmet-async';
import AppRouter from './AppRouter';
import './index.css';
import i18n, {
  STORAGE_KEY,
  restoreEnBundleFromCache,
  mergeEnBundle,
  CACHE_KEY,
  CACHE_VERSION_KEY,
  CACHE_VERSION,
} from './i18n';
import { getInitialLanguage } from './getInitialLanguage';

/** При mount: ако потребителят е избрал EN но bundle липсва (напр. sync възстановяването не е минало), възстановява от кеш и прерисува. */
function EnBundleRestore() {
  useEffect(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const wantEn = stored === 'en' || (stored && stored.startsWith('en'));
    if (wantEn && !i18n.hasResourceBundle('en', 'translation')) {
      if (restoreEnBundleFromCache()) {
        i18n.changeLanguage('en');
      } else {
        i18n.changeLanguage('bg');
      }
    }
  }, []);
  return null;
}

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <EnBundleRestore />
      <AuthProvider>
        <HelmetProvider>
          <AppRouter />
        </HelmetProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

async function ensureEnBundle(): Promise<boolean> {
  if (i18n.hasResourceBundle('en', 'translation')) return true;
  if (restoreEnBundleFromCache()) return true;
  try {
    const res = await fetch('/api/translate?target=en');
    if (!res.ok) return false;
    const data = await res.json();
    const merged = mergeEnBundle(data);
    i18n.addResourceBundle('en', 'translation', merged);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
    }
    return true;
  } catch {
    return false;
  }
}

function renderApp() {
  ReactDOM.createRoot(document.getElementById('root')!).render(app);
}

async function bootstrap() {
  const hasStored = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
  if (hasStored) {
    renderApp();
    return;
  }
  const rootEl = document.getElementById('root');
  if (rootEl) rootEl.innerHTML = '<div style="color:#E0E0E0;padding:1rem;font-family:Inter,sans-serif">Loading…</div>';
  let lng: 'bg' | 'en' = await getInitialLanguage();
  if (lng === 'en') {
    const ok = await ensureEnBundle();
    if (!ok) {
      lng = 'bg';
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'bg');
      i18n.changeLanguage('bg');
    } else {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'en');
      i18n.changeLanguage('en');
    }
  } else {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'bg');
    i18n.changeLanguage('bg');
  }
  if (rootEl) rootEl.innerHTML = '';
  renderApp();
}

bootstrap();
