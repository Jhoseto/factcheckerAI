import React, { useEffect, useState } from 'react';
import { fetchAdminJson } from '../api';

interface Activity {
    id: string;
    userId?: string;
    action?: string;
    metadata?: Record<string, unknown>;
    timestamp?: string;
}

export const ActivityLog: React.FC = () => {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [userIdFilter, setUserIdFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');

    const load = () => {
        const params = new URLSearchParams();
        if (userIdFilter) params.set('userId', userIdFilter);
        if (actionFilter) params.set('action', actionFilter);
        params.set('limit', '100');
        fetchAdminJson<{ activities: Activity[] }>(`/activity?${params}`)
            .then(d => setActivities(d.activities || []))
            .catch(() => setActivities([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        setLoading(true);
        load();
    }, [userIdFilter, actionFilter]);

    const actionLabels: Record<string, string> = {
        analysis_video: 'Видео анализ',
        analysis_link: 'Линк анализ',
        login: 'Логване',
        archive_save: 'Запазване в архив',
        report_share: 'Споделяне на доклад'
    };

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-black text-[#C4B091] uppercase tracking-tight">Дневник на активностите</h1>
            <div className="flex flex-wrap gap-4">
                <input
                    type="text"
                    placeholder="Филтър по потребител..."
                    value={userIdFilter}
                    onChange={e => setUserIdFilter(e.target.value)}
                    className="px-4 py-2 bg-[#252525] border border-[#333] rounded text-sm text-[#ddd] placeholder-[#666] w-48"
                />
                <select
                    value={actionFilter}
                    onChange={e => setActionFilter(e.target.value)}
                    className="px-4 py-2 bg-[#252525] border border-[#333] rounded text-sm text-[#ddd]"
                >
                    <option value="">Всички действия</option>
                    <option value="analysis_video">Видео анализ</option>
                    <option value="analysis_link">Линк анализ</option>
                    <option value="login">Логване</option>
                    <option value="archive_save">Запазване в архив</option>
                    <option value="report_share">Споделяне</option>
                </select>
            </div>
            {loading ? (
                <div className="text-[#888]">Зареждане...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#333]">
                                <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Потребител</th>
                                <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Действие</th>
                                <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Метаданни</th>
                                <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Дата</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activities.map(a => (
                                <tr key={a.id} className="border-b border-[#333] hover:bg-[#252525]">
                                    <td className="py-3 px-2 text-[#888] font-mono text-[10px]">{a.userId ? `${a.userId.slice(0, 12)}…` : '—'}</td>
                                    <td className="py-3 px-2 text-[#968B74] font-bold">{actionLabels[a.action || ''] || a.action}</td>
                                    <td className="py-3 px-2 text-[#666] text-[10px]">{a.metadata && Object.keys(a.metadata).length ? JSON.stringify(a.metadata).slice(0, 50) : '—'}</td>
                                    <td className="py-3 px-2 text-[#888] text-[10px]">{(a.timestamp || '').slice(0, 19)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
