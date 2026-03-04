import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '';

export interface PublicConfig {
    maintenanceMode: boolean;
    newRegistrationEnabled: boolean;
    maxAnalysesPerDay: number | null;
    announcement: { text: string; until?: string } | null;
}

const defaultConfig: PublicConfig = {
    maintenanceMode: false,
    newRegistrationEnabled: true,
    maxAnalysesPerDay: null,
    announcement: null
};

const PublicConfigContext = createContext<PublicConfig>(defaultConfig);

export const usePublicConfig = () => useContext(PublicConfigContext);

export const PublicConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<PublicConfig>(defaultConfig);

    useEffect(() => {
        fetch(`${API_BASE}/api/config/public`)
            .then(r => r.json())
            .then(d => setConfig({
                maintenanceMode: !!d.maintenanceMode,
                newRegistrationEnabled: d.newRegistrationEnabled !== false,
                maxAnalysesPerDay: d.maxAnalysesPerDay ?? null,
                announcement: d.announcement || null
            }))
            .catch(() => {});
    }, []);

    return (
        <PublicConfigContext.Provider value={config}>
            {children}
        </PublicConfigContext.Provider>
    );
};
