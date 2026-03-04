import React, { useEffect, useState } from 'react';
import { fetchAdminJson } from '../api';

interface RevenueData {
    totalPoints: number;
    totalEur: number;
    byMonth: Record<string, number>;
    byMonthEur: Record<string, number>;
    transactions: Array<{ id: string; userId?: string; amount?: number; createdAt?: string }>;
}

export const Revenue: React.FC = () => {
    const [data, setData] = useState<RevenueData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAdminJson<RevenueData>('/revenue')
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="text-[#888]">Зареждане...</div>;
    if (!data) return <div className="text-[#c66]">Грешка при зареждане</div>;

    const months = Object.entries(data.byMonthEur || {}).sort(([a], [b]) => b.localeCompare(a));

    return (
        <div className="space-y-8">
            <h1 className="text-xl font-black text-[#C4B091] uppercase tracking-tight">Приходи</h1>
            <p className="text-[10px] text-[#666] -mt-4">Само реални покупки (без бонуси, Lemon Squeezy тест режим и ръчни добавки)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
                    <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-1">Общо точки</p>
                    <p className="text-2xl font-black text-[#C4B091]">{data.totalPoints?.toLocaleString() ?? 0}</p>
                </div>
                <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
                    <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-1">Общо EUR</p>
                    <p className="text-2xl font-black text-[#C4B091]">€{data.totalEur?.toFixed(2) ?? '0.00'}</p>
                </div>
            </div>
            <div>
                <h2 className="text-sm font-black text-[#888] uppercase mb-3">По месец</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#333]">
                                <th className="text-left py-2 text-[8px] text-[#666]">Месец</th>
                                <th className="text-right py-2 text-[8px] text-[#666]">Точки</th>
                                <th className="text-right py-2 text-[8px] text-[#666]">EUR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {months.map(([month, eur]) => (
                                <tr key={month} className="border-b border-[#333]">
                                    <td className="py-2 text-[#ddd]">{month}</td>
                                    <td className="py-2 text-right font-bold text-[#C4B091]">{(data.byMonth?.[month] || 0).toLocaleString()}</td>
                                    <td className="py-2 text-right font-bold text-[#C4B091]">€{eur.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div>
                <h2 className="text-sm font-black text-[#888] uppercase mb-3">Последни покупки</h2>
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#333]">
                                <th className="text-left py-2 text-[8px] text-[#666]">Потребител</th>
                                <th className="text-right py-2 text-[8px] text-[#666]">Точки</th>
                                <th className="text-left py-2 text-[8px] text-[#666]">Дата</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.transactions?.slice(0, 20).map(t => (
                                <tr key={t.id} className="border-b border-[#333]">
                                    <td className="py-2 text-[#888] font-mono text-[10px]">{(t.userId || '').slice(0, 12)}…</td>
                                    <td className="py-2 text-right font-bold text-[#C4B091]">{t.amount ?? 0}</td>
                                    <td className="py-2 text-[#888] text-[10px]">{(t.createdAt || '').slice(0, 16)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
