import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { trackVisit } from './services/visitTracker';
import { AnnouncementBanner } from './components/common/AnnouncementBanner';
import { UserMessageBanner } from './components/common/UserMessageBanner';
import { MaintenanceOverlay } from './components/common/MaintenanceOverlay';
import { useAuth } from './contexts/AuthContext';
import { usePublicConfig } from './contexts/PublicConfigContext';
import Navbar from './components/common/Navbar';
import LegalFooter from './components/common/LegalFooter';
import ChatWidget from './chatBot/src/components/ChatWidget';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import App from './App';

const PricingPage = lazy(() => import('./components/pricing/PricingPage'));
const ExpensesPage = lazy(() => import('./components/user/ExpensesPage'));
const ArchivePage = lazy(() => import('./components/archive/ArchivePage'));
const ReportPage = lazy(() => import('./components/report/ReportPage'));
const AdminApp = lazy(() => import('./admin/client/index').then(m => ({ default: m.AdminApp })));
const TermsPage = lazy(() => import('./components/legal/TermsPage'));
const PrivacyPage = lazy(() => import('./components/legal/PrivacyPage'));
const RefundPage = lazy(() => import('./components/legal/RefundPage'));
const MobileView = lazy(() => import('./mobileView').then(m => ({ default: m.MobileView })));

const MOBILE_BREAKPOINT = 768;

const PageFallback = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#222]">
        <div className="w-16 h-16 border-4 border-[#333] border-t-[#968B74] rounded-full animate-spin shadow-[0_0_30px_rgba(150,139,116,0.2)]"></div>
    </div>
);

const AppRouter: React.FC = () => {
    const { currentUser, loading, refreshProfile } = useAuth();
    const { newRegistrationEnabled } = usePublicConfig();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        if (!loading) trackVisit(location.pathname || '/', 'page_view');
    }, [loading]);

    // Refresh profile when returning from successful payment
    useEffect(() => {
        if (loading || !currentUser) return;
        if (searchParams.get('payment') === 'success') {
            refreshProfile();
            navigate(location.pathname || '/', { replace: true });
        }
    }, [loading, currentUser, searchParams.get('payment'), refreshProfile, navigate, location.pathname]);
    const forceMobile = searchParams.get('mobile') === '1';
    const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT);

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
        const handler = () => setIsNarrow(mql.matches);
        mql.addEventListener('change', handler);
        handler();
        return () => mql.removeEventListener('change', handler);
    }, []);

    const showMobileView = forceMobile || isNarrow;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#222]">
                <div className="text-center space-y-6">
                    <div className="w-16 h-16 border-4 border-[#333] border-t-[#968B74] rounded-full animate-spin mx-auto shadow-[0_0_30px_rgba(150,139,116,0.2)]"></div>
                    <p className="text-sm font-black text-[#968B74] uppercase tracking-widest animate-pulse">Зареждане...</p>
                </div>
            </div>
        );
    }

    if (showMobileView) {
        return (
            <Suspense fallback={<PageFallback />}>
                <MobileView />
            </Suspense>
        );
    }

    return (
        <>
            <MaintenanceOverlay />
            <AnnouncementBanner />
            <UserMessageBanner />
            <Navbar />
            <LegalFooter />
            <ChatWidget />
            <Suspense fallback={<PageFallback />}>
            <Routes>
                {/* Public routes */}
                <Route
                    path="/login"
                    element={currentUser ? <Navigate to="/" replace /> : <Login />}
                />
                <Route
                    path="/register"
                    element={currentUser ? <Navigate to="/" replace /> : !newRegistrationEnabled ? <Navigate to="/login?reg=disabled" replace /> : <Register />}
                />

                {/* Main app - PUBLIC, authentication checked on analysis action */}
                <Route
                    path="/"
                    element={<App />}
                />

                {/* Pricing - requires authentication */}
                <Route
                    path="/pricing"
                    element={currentUser ? <PricingPage /> : <Navigate to="/login" replace />}
                />

                {/* Expenses & History - requires authentication */}
                <Route
                    path="/expenses"
                    element={currentUser ? <ExpensesPage /> : <Navigate to="/login" replace />}
                />

                {/* Admin Panel - requires authentication + admin claim */}
                <Route
                    path="/admin/*"
                    element={currentUser ? <AdminApp /> : <Navigate to="/login" replace />}
                />
                <Route
                    path="/chat-admin"
                    element={<Navigate to="/admin/chat" replace />}
                />

                {/* Archive - saved analyses */}
                <Route
                    path="/archive"
                    element={currentUser ? <ArchivePage /> : <Navigate to="/login" replace />}
                />

                {/* Shared Report - Publicly accessible */}
                <Route path="/analysis-result" element={<ReportPage />} />
                <Route path="/report/:id" element={<ReportPage />} />

                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/refund-policy" element={<RefundPage />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
        </>
    );
};

export default AppRouter;
