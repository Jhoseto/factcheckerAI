import './i18n';
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { HelmetProvider } from 'react-helmet-async';
import AppRouter from './AppRouter';
import './index.css';
import i18n, { STORAGE_KEY, restoreEnBundleFromCache } from './i18n';

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

ReactDOM.createRoot(document.getElementById('root')!).render(
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
