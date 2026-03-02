import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './mobileView.css';
import MobileHome from './MobileHome';
import MobileAudit from './MobileAudit';
import MobileReportPage from './MobileReportPage';
import MobileProfile from './MobileProfile';
import MobileExpensesPage from './MobileExpensesPage';
import MobileBottomNav from './components/MobileBottomNav';
import ArchivePage from '../components/archive/ArchivePage';
import PricingPage from '../components/pricing/PricingPage';
import Login from '../components/auth/Login';
import Register from '../components/auth/Register';
import TermsPage from '../components/legal/TermsPage';
import PrivacyPage from '../components/legal/PrivacyPage';
import RefundPage from '../components/legal/RefundPage';
/**
 * Mobile app shell: bottom tab bar + routes. Use when viewport ≤768px or ?mobile=1.
 */
const MobileView: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="mobile-root h-screen flex flex-col overflow-hidden">
      <main
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'max(5rem, env(safe-area-inset-bottom, 0px) + 5rem)' }}
      >
        <Routes>
          <Route path="/" element={<MobileHome />} />
          <Route path="/audit" element={<MobileAudit />} />
          <Route path="/analysis-result" element={<MobileReportPage />} />
          <Route path="/report/:id" element={<MobileReportPage />} />
          <Route path="/archive" element={currentUser ? <ArchivePage /> : <Navigate to="/login" replace />} />
          <Route path="/pricing" element={currentUser ? <PricingPage /> : <Navigate to="/login" replace />} />
          <Route path="/profile" element={currentUser ? <MobileProfile /> : <Navigate to="/login" replace />} />
          <Route path="/expenses" element={currentUser ? <MobileExpensesPage /> : <Navigate to="/login" replace />} />
          <Route path="/login" element={currentUser ? <Navigate to="/profile" replace /> : <Login />} />
          <Route path="/register" element={currentUser ? <Navigate to="/profile" replace /> : <Register />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/refund-policy" element={<RefundPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <MobileBottomNav />
    </div>
  );
};

export default MobileView;
