import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PublicConfigProvider } from './contexts/PublicConfigContext';
import { HelmetProvider } from 'react-helmet-async';
import AppRouter from './AppRouter';
import './index.css';

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PublicConfigProvider>
          <HelmetProvider>
            <AppRouter />
          </HelmetProvider>
        </PublicConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

ReactDOM.createRoot(document.getElementById('root')!).render(app);
