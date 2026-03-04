import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminJson } from '../api';

interface AnalysisItem {
    id: string;
    userId: string;
    type: string;
    title: string;
    url?: string;
    createdAt: string;
    isPublic: boolean;
    pointsCost: number;
}

export const AnalysesList: React.FC = () => {
    const [list, setList] = useState<AnalysisItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAdminJson<AnalysisItem[]>('/analyses/list?limit=100')
            .then(setList)
            .catch(() => setList([]))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="text-[#888]">Зареждане...</div>;

    const typeLabels: Record<string, string> = { video: 'Видео', link: 'Линк', social: 'Социални' };

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-black text-[#C4B091] uppercase tracking-tight">Списък анализи</h1>
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b border-[#333]">
                            <th className="text-left py-3 px-2 text-[9px] font-black text-[#888] uppercase">Тип</th>
                            <th className="text-left py-3 px-2 text-[9px] font-black text-[#888] uppercase">Заглавие</th>
                            <th className="text-left py-3 px-2 text-[9px] font-black text-[#888] uppercase">Потребител</th>
                            <th className="text-left py-3 px-2 text-[9px] font-black text-[#888] uppercase">Дата</th>
                            <th className="text-left py-3 px-2 text-[9px] font-black text-[#888] uppercase">Точки</th>
                            <th className="text-left py-3 px-2 text-[9px] font-black text-[#888] uppercase">Доклад</th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.length === 0 && (
                            <tr><td colSpan={6} className="py-8 text-center text-[#666]">Няма анализи</td></tr>
                        )}
                        {list.map(a => (
                            <tr key={a.id} className="border-b border-[#252525] hover:bg-[#252525]/50">
                                <td className="py-2 px-2">
                                    <span className="text-[#968B74] font-bold">{typeLabels[a.type] || a.type}</span>
                                </td>
                                <td className="py-2 px-2 text-[#ddd] max-w-xs truncate" title={a.title || a.url}>
                                    {a.title || a.url || a.id}
                                </td>
                                <td className="py-2 px-2">
                                    {a.userId ? (
                                        <Link to={`/admin/users/${a.userId}`} className="text-[#968B74] hover:text-[#C4B091] text-[10px] font-mono">
                                            {a.userId.slice(0, 8)}…
                                        </Link>
                                    ) : (
                                        <span className="text-[#555]">—</span>
                                    )}
                                </td>
                                <td className="py-2 px-2 text-[#666] text-[10px]">{(a.createdAt || '').slice(0, 10)}</td>
                                <td className="py-2 px-2 text-[#C4B091] font-bold">{a.pointsCost ?? 0}</td>
                                <td className="py-2 px-2">
                                    {a.isPublic ? (
                                        <a
                                            href={`${window.location.origin}/report/${a.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#968B74] hover:text-[#C4B091] text-[8px] font-bold uppercase"
                                        >
                                            Отвори
                                        </a>
                                    ) : (
                                        <span className="text-[#555] text-[8px]">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
