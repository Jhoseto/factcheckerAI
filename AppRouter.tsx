import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/common/Navbar';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import PricingPage from './components/pricing/PricingPage';
import ExpensesPage from './components/user/ExpensesPage';
import LinkAuditPage from './components/linkAudit/LinkAuditPage';

import ArchivePage from './components/archive/ArchivePage';
import ReportPage from './components/report/ReportPage';
import App from './App';
import { MobileView } from './mobileView';

const MOBILE_BREAKPOINT = 768;

const AppRouter: React.FC = () => {
    const { currentUser, loading } = useAuth();
    const [searchParams] = useSearchParams();
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
        return <MobileView />;
    }

    return (
        <>
            <Navbar />
            <Routes>
                {/* Public routes */}
                <Route
                    path="/login"
                    element={currentUser ? <Navigate to="/" replace /> : <Login />}
                />
                <Route
                    path="/register"
                    element={currentUser ? <Navigate to="/" replace /> : <Register />}
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

                {/* Archive - saved analyses */}
                <Route
                    path="/archive"
                    element={currentUser ? <ArchivePage /> : <Navigate to="/login" replace />}
                />

                {/* Shared Report - Publicly accessible */}
                <Route path="/analysis-result" element={<ReportPage />} />
                <Route path="/report/:id" element={<ReportPage />} />




                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </>
    );
};

export default AppRouter;
