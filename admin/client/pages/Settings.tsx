import React, { useEffect, useState } from 'react';
import { fetchAdmin, fetchAdminJson } from '../api';

interface Config {
    maintenanceMode?: boolean;
    newRegistrationEnabled?: boolean;
    maxAnalysesPerDay?: number;
    announcement?: { text?: string; enabled?: boolean; until?: string };
}

export const Settings: React.FC = () => {
    const [config, setConfig] = useState<Config>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [newRegistrationEnabled, setNewRegistrationEnabled] = useState(true);
    const [announcementText, setAnnouncementText] = useState('');
    const [announcementEnabled, setAnnouncementEnabled] = useState(false);

    useEffect(() => {
        fetchAdminJson<Config>('/config')
            .then(c => {
                setConfig(c);
                setMaintenanceMode(!!c.maintenanceMode);
                setNewRegistrationEnabled(c.newRegistrationEnabled !== false);
                setAnnouncementText(c.announcement?.text || '');
                setAnnouncementEnabled(!!c.announcement?.enabled);
            })
            .catch(() => { setConfig({}); setMaintenanceMode(false); setNewRegistrationEnabled(true); })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetchAdmin('/config', {
                method: 'PUT',
                body: JSON.stringify({
                    maintenanceMode,
                    newRegistrationEnabled,
                    announcement: { text: announcementText, enabled: announcementEnabled }
                })
            });
            if (res.ok) {
                const c = await fetchAdminJson<Config>('/config');
                setConfig(c);
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-[#888]">Зареждане...</div>;

    return (
        <div className="space-y-8">
            <h1 className="text-xl font-black text-[#C4B091] uppercase tracking-tight">Системни настройки</h1>
            <div className="p-5 bg-[#252525] border border-[#333] rounded-sm space-y-6 max-w-xl">
                <label className="flex items-center gap-3">
                    <input type="checkbox" checked={maintenanceMode} onChange={e => setMaintenanceMode(e.target.checked)} className="rounded" />
                    <span className="text-sm text-[#ddd]">Режим на поддръжка</span>
                </label>
                <label className="flex items-center gap-3">
                    <input type="checkbox" checked={newRegistrationEnabled} onChange={e => setNewRegistrationEnabled(e.target.checked)} className="rounded" />
                    <span className="text-sm text-[#ddd]">Нови регистрации разрешени</span>
                </label>
                <div>
                    <label className="block text-[8px] text-[#666] uppercase mb-2">Известие / банер</label>
                    <label className="flex items-center gap-3 mb-2">
                        <input type="checkbox" checked={announcementEnabled} onChange={e => setAnnouncementEnabled(e.target.checked)} className="rounded" />
                        <span className="text-sm text-[#ddd]">Показване на известие</span>
                    </label>
                    <textarea
                        value={announcementText}
                        onChange={e => setAnnouncementText(e.target.value)}
                        placeholder="Текст на известието..."
                        rows={3}
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-[#ddd] placeholder-[#666]"
                    />
                </div>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[#968B74] text-[#1a1a1a] text-[9px] font-bold uppercase rounded hover:bg-[#a69b7a] disabled:opacity-50">
                    Запази
                </button>
            </div>
        </div>
    );
};
