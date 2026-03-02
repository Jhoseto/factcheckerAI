import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { HelmetProvider } from 'react-helmet-async';
import AppRouter from './AppRouter';
import './index.css';

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <HelmetProvider>
          <AppRouter />
        </HelmetProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

ReactDOM.createRoot(document.getElementById('root')!).render(app);
