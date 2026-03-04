/**
 * Admin App — entry, verify guard, routes
 */
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { fetchAdminJson } from './api';
import AdminLayout from './AdminLayout';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { UserDetail } from './pages/UserDetail';
import { Admins } from './pages/Admins';
import { Transactions } from './pages/Transactions';
import { Analyses } from './pages/Analyses';
import { AnalysesList } from './pages/AnalysesList';
import { VisitLog } from './pages/VisitLog';
import { ActivityLog } from './pages/ActivityLog';
import { Revenue } from './pages/Revenue';
import { Settings } from './pages/Settings';

export const AdminApp: React.FC = () => {
    const navigate = useNavigate();
    const [verified, setVerified] = useState<boolean | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    useEffect(() => {
        fetchAdminJson<{ ok?: boolean; isSuperAdmin?: boolean }>('/verify')
            .then((d) => {
                setVerified(!!d.ok);
                setIsSuperAdmin(!!d.isSuperAdmin);
            })
            .catch(() => setVerified(false));
    }, []);

    if (verified === null) {
        return (
            <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
                <div className="text-[#888]">Проверка на админ достъп...</div>
            </div>
        );
    }
    if (!verified) {
        return <Navigate to="/" replace />;
    }

    return (
        <Routes>
            <Route element={<AdminLayout isSuperAdmin={isSuperAdmin} />}>
                <Route index element={<Dashboard />} />
                <Route path="users" element={<Users />} />
                <Route path="users/:uid" element={<UserDetail />} />
                <Route path="admins" element={<Admins />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="analyses" element={<Analyses />} />
                <Route path="analyses-list" element={<AnalysesList />} />
                <Route path="visits" element={<VisitLog />} />
                <Route path="activity" element={<ActivityLog />} />
                <Route path="revenue" element={<Revenue />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>
        </Routes>
    );
};
