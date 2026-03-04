import React, { useEffect, useState } from 'react';
import { fetchAdmin, fetchAdminJson } from '../api';

interface Config {
    maintenanceMode?: boolean;
    newRegistrationEnabled?: boolean;
    maxAnalysesPerDay?: number;
    announcement?: { text?: string; enabled?: boolean; until?: string };
}

interface UserMessage {
    id: string;
    message: string;
    userIds: string[] | 'all';
    enabled: boolean;
    until?: string;
    createdAt?: string;
}

export const Settings: React.FC = () => {
    const [config, setConfig] = useState<Config>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [newRegistrationEnabled, setNewRegistrationEnabled] = useState(true);
    const [maxAnalysesPerDay, setMaxAnalysesPerDay] = useState<string>('');
    const [announcementText, setAnnouncementText] = useState('');
    const [announcementEnabled, setAnnouncementEnabled] = useState(false);

    const [userMessages, setUserMessages] = useState<UserMessage[]>([]);
    const [msgText, setMsgText] = useState('');
    const [msgUserIds, setMsgUserIds] = useState<string>('all');
    const [msgUntil, setMsgUntil] = useState('');
    const [msgEnabled, setMsgEnabled] = useState(true);

    useEffect(() => {
        fetchAdminJson<Config>('/config')
            .then(c => {
                setConfig(c);
                setMaintenanceMode(!!c.maintenanceMode);
                setNewRegistrationEnabled(c.newRegistrationEnabled !== false);
                setMaxAnalysesPerDay(c.maxAnalysesPerDay != null ? String(c.maxAnalysesPerDay) : '');
                setAnnouncementText(c.announcement?.text || '');
                setAnnouncementEnabled(!!c.announcement?.enabled);
            })
            .catch(() => { setConfig({}); setMaintenanceMode(false); setNewRegistrationEnabled(true); })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchAdminJson<{ messages: UserMessage[] }>('/user-messages')
            .then(d => setUserMessages(d.messages || []))
            .catch(() => setUserMessages([]));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetchAdmin('/config', {
                method: 'PUT',
                body: JSON.stringify({
                    maintenanceMode,
                    newRegistrationEnabled,
                    maxAnalysesPerDay: maxAnalysesPerDay ? parseInt(maxAnalysesPerDay, 10) : null,
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

    const handleAddMessage = async () => {
        const text = msgText.trim();
        if (!text) return;
        const userIds = msgUserIds.trim().toLowerCase() === 'all' ? 'all' : msgUserIds.split(/[\s,]+/).filter(Boolean);
        try {
            const res = await fetchAdmin('/user-messages', {
                method: 'POST',
                body: JSON.stringify({ message: text, userIds, enabled: msgEnabled, until: msgUntil || null })
            });
            if (res.ok) {
                const d = await fetchAdminJson<{ messages: UserMessage[] }>('/user-messages');
                setUserMessages(d.messages || []);
                setMsgText('');
                setMsgUntil('');
            }
        } catch { /* ignore */ }
    };

    const toggleMessage = async (id: string, enabled: boolean) => {
        try {
            const res = await fetchAdmin(`/user-messages/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ enabled })
            });
            if (res.ok) {
                setUserMessages(prev => prev.map(m => m.id === id ? { ...m, enabled } : m));
            }
        } catch { /* ignore */ }
    };

    const deleteMessage = async (id: string) => {
        if (!confirm('Изтрий това съобщение?')) return;
        try {
            const res = await fetchAdmin(`/user-messages/${id}`, { method: 'DELETE' });
            if (res.ok) setUserMessages(prev => prev.filter(m => m.id !== id));
        } catch { /* ignore */ }
    };

    if (loading) return <div className="text-[#888]">Зареждане...</div>;

    return (
        <div className="space-y-10">
            <h1 className="text-xl font-black text-[#C4B091] uppercase tracking-tight">Системни настройки</h1>

            <div className="p-5 bg-[#252525] border border-[#333] rounded-sm space-y-6 max-w-xl">
                <h2 className="text-sm font-black text-[#888] uppercase mb-2">Общи</h2>
                <label className="flex items-center gap-3">
                    <input type="checkbox" checked={maintenanceMode} onChange={e => setMaintenanceMode(e.target.checked)} className="rounded" />
                    <span className="text-sm text-[#ddd]">Режим на поддръжка</span>
                </label>
                <label className="flex items-center gap-3">
                    <input type="checkbox" checked={newRegistrationEnabled} onChange={e => setNewRegistrationEnabled(e.target.checked)} className="rounded" />
                    <span className="text-sm text-[#ddd]">Нови регистрации разрешени</span>
                </label>
                <div>
                    <label className="block text-[8px] text-[#666] uppercase mb-2">Макс. анализи на ден (на потребител)</label>
                    <input
                        type="number"
                        value={maxAnalysesPerDay}
                        onChange={e => setMaxAnalysesPerDay(e.target.value)}
                        placeholder="Празно = без лимит"
                        min={0}
                        className="w-32 px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-[#ddd]"
                    />
                </div>
                <div>
                    <label className="block text-[8px] text-[#666] uppercase mb-2">Известие / банер (глобално)</label>
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

            <div className="p-5 bg-[#252525] border border-[#333] rounded-sm space-y-4 max-w-2xl">
                <h2 className="text-sm font-black text-[#888] uppercase">Съобщения до потребители</h2>
                <p className="text-[10px] text-[#666]">Изпращане на индивидуални съобщения до конкретен потребител (UID) или група (UID-та разделени със запетая) или „all“ за всички.</p>
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[8px] text-[#666] uppercase mb-1">Текст</label>
                        <input
                            value={msgText}
                            onChange={e => setMsgText(e.target.value)}
                            placeholder="Съобщение..."
                            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-[#ddd]"
                        />
                    </div>
                    <div className="w-48">
                        <label className="block text-[8px] text-[#666] uppercase mb-1">Получатели (UID или all)</label>
                        <input
                            value={msgUserIds}
                            onChange={e => setMsgUserIds(e.target.value)}
                            placeholder="all или uid1,uid2"
                            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-[#ddd]"
                        />
                    </div>
                    <div className="w-40">
                        <label className="block text-[8px] text-[#666] uppercase mb-1">Валидно до (YYYY-MM-DD)</label>
                        <input
                            type="date"
                            value={msgUntil}
                            onChange={e => setMsgUntil(e.target.value)}
                            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-[#ddd]"
                        />
                    </div>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={msgEnabled} onChange={e => setMsgEnabled(e.target.checked)} className="rounded" />
                        <span className="text-[10px] text-[#888]">Активно</span>
                    </label>
                    <button onClick={handleAddMessage} disabled={!msgText.trim()} className="px-4 py-2 bg-[#4a7c59] text-white text-[9px] font-bold uppercase rounded hover:bg-[#5a8c69] disabled:opacity-50">
                        Добави
                    </button>
                </div>
                <div className="space-y-2 mt-4">
                    {userMessages.map(m => (
                        <div key={m.id} className="flex items-center justify-between gap-4 p-3 bg-[#1a1a1a] rounded border border-[#333]">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-[#ddd] truncate">{m.message}</p>
                                <p className="text-[10px] text-[#666] mt-1">
                                    {m.userIds === 'all' ? 'Всички' : (Array.isArray(m.userIds) ? m.userIds.join(', ') : '')}
                                    {m.until && ` • до ${(m.until || '').slice(0, 10)}`}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => toggleMessage(m.id, !m.enabled)} className={`px-2 py-1 text-[8px] font-bold uppercase rounded ${m.enabled ? 'bg-[#4a7c59] text-white' : 'bg-[#333] text-[#666]'}`}>
                                    {m.enabled ? 'Вкл' : 'Изкл'}
                                </button>
                                <button onClick={() => deleteMessage(m.id)} className="px-2 py-1 text-[8px] font-bold text-[#8b4a4a] hover:bg-[#8b4a4a]/20 rounded uppercase">
                                    Изтрий
                                </button>
                            </div>
                        </div>
                    ))}
                    {userMessages.length === 0 && <p className="text-[#666] text-sm">Няма съобщения</p>}
                </div>
            </div>
        </div>
    );
};
