import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePublicConfig } from '../../contexts/PublicConfigContext';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '';

export const MaintenanceOverlay: React.FC = () => {
    const { maintenanceMode } = usePublicConfig();
    const { currentUser } = useAuth();
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

    useEffect(() => {
        if (!maintenanceMode || !currentUser) {
            setIsAdmin(false);
            return;
        }
        let cancelled = false;
        currentUser.getIdToken().then(token =>
            fetch(`${API_BASE}/api/admin/verify`, { headers: { Authorization: `Bearer ${token}` } })
        ).then(r => r?.ok ?? false).then(ok => { if (!cancelled) setIsAdmin(!!ok); }).catch(() => { if (!cancelled) setIsAdmin(false); });
        return () => { cancelled = true; };
    }, [maintenanceMode, currentUser]);

    if (!maintenanceMode || isAdmin) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#0a0a0a]/95 backdrop-blur-md">
            <div className="max-w-md mx-auto p-10 text-center">
                <h1 className="text-2xl font-black text-[#C4B091] uppercase tracking-tight mb-4">
                    Режим на поддръжка
                </h1>
                <p className="text-[#888] text-sm mb-6">
                    Сайтът е временно недостъпен за поддръжка. Моля, опитайте отново по-късно.
                </p>
                <p className="text-[#666] text-[10px]">FACTCHECKER AI</p>
            </div>
        </div>
    );
};
