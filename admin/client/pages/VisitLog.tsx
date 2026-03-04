import React, { useEffect, useState } from 'react';
import { fetchAdminJson } from '../api';

interface Visit {
    id: string;
    ip?: string;
    userId?: string;
    path?: string;
    userAgent?: string;
    action?: string;
    timestamp?: string;
}

export const VisitLog: React.FC = () => {
    const [visits, setVisits] = useState<Visit[]>([]);
    const [loading, setLoading] = useState(true);
    const [ipFilter, setIpFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');

    const load = () => {
        const params = new URLSearchParams();
        if (ipFilter) params.set('ip', ipFilter);
        if (actionFilter) params.set('action', actionFilter);
        params.set('limit', '100');
        fetchAdminJson<{ visits: Visit[] }>(`/visits?${params}`)
            .then(d => setVisits(d.visits || []))
            .catch(() => setVisits([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        setLoading(true);
        load();
    }, [ipFilter, actionFilter]);

    const actionLabels: Record<string, string> = { page_view: 'Вход', login: 'Логване' };

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-black text-[#C4B091] uppercase tracking-tight">Посещения</h1>
            <div className="flex flex-wrap gap-4">
                <input
                    type="text"
                    placeholder="Филтър по IP..."
                    value={ipFilter}
                    onChange={e => setIpFilter(e.target.value)}
                    className="px-4 py-2 bg-[#252525] border border-[#333] rounded text-sm text-[#ddd] placeholder-[#666] w-40"
                />
                <select
                    value={actionFilter}
                    onChange={e => setActionFilter(e.target.value)}
                    className="px-4 py-2 bg-[#252525] border border-[#333] rounded text-sm text-[#ddd]"
                >
                    <option value="">Всички действия</option>
                    <option value="page_view">Вход</option>
                    <option value="login">Логване</option>
                </select>
            </div>
            {loading ? (
                <div className="text-[#888]">Зареждане...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#333]">
                                <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">IP</th>
                                <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Потребител</th>
                                <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Действие</th>
                                <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Път</th>
                                <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Дата</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visits.map(v => (
                                <tr key={v.id} className="border-b border-[#333] hover:bg-[#252525]">
                                    <td className="py-3 px-2 text-[#ddd] font-mono text-[10px]">{v.ip || '—'}</td>
                                    <td className="py-3 px-2 text-[#888] text-[10px]">{v.userId ? `${v.userId.slice(0, 12)}…` : 'Анонимен'}</td>
                                    <td className="py-3 px-2 text-[#968B74] font-bold">{actionLabels[v.action || ''] || v.action}</td>
                                    <td className="py-3 px-2 text-[#888] text-[10px]">{(v.path || '/').slice(0, 30)}</td>
                                    <td className="py-3 px-2 text-[#888] text-[10px]">{(v.timestamp || '').slice(0, 19)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
