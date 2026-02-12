import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import PricingPage from './components/pricing/PricingPage';
import App from './App';

const AppRouter: React.FC = () => {
    const { currentUser, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50/30 to-slate-50">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-slate-200 border-t-amber-900 rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Зареждане...</p>
                </div>
            </div>
        );
    }

    return (
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

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default AppRouter;
