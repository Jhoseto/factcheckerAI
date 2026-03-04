import React, { useEffect, useState } from 'react';
import { fetchAdminJson } from '../api';

interface Aggregation {
    byType: { video?: number; link?: number };
    byDay: Record<string, number>;
    total: number;
}

export const Analyses: React.FC = () => {
    const [data, setData] = useState<Aggregation | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAdminJson<Aggregation>('/analyses')
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="text-[#888]">Зареждане...</div>;
    if (!data) return <div className="text-[#c66]">Грешка при зареждане</div>;

    const days = Object.entries(data.byDay || {}).sort(([a], [b]) => a.localeCompare(b));

    return (
        <div className="space-y-8">
            <h1 className="text-xl font-black text-[#C4B091] uppercase tracking-tight">Анализи</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
                    <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-1">Общо (7 дни)</p>
                    <p className="text-2xl font-black text-[#C4B091]">{data.total}</p>
                </div>
                <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
                    <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-1">Video</p>
                    <p className="text-2xl font-black text-[#C4B091]">{data.byType?.video ?? 0}</p>
                </div>
                <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
                    <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-1">Линк</p>
                    <p className="text-2xl font-black text-[#C4B091]">{data.byType?.link ?? 0}</p>
                </div>
            </div>
            <div>
                <h2 className="text-sm font-black text-[#888] uppercase mb-3">By day</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#333]">
                                <th className="text-left py-2 text-[8px] text-[#666]">Дата</th>
                                <th className="text-right py-2 text-[8px] text-[#666]">Брой</th>
                            </tr>
                        </thead>
                        <tbody>
                            {days.map(([day, count]) => (
                                <tr key={day} className="border-b border-[#333]">
                                    <td className="py-2 text-[#ddd]">{day}</td>
                                    <td className="py-2 text-right font-bold text-[#C4B091]">{count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
