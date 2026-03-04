import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchAdminJson } from '../api';
import { StatsCard } from '../components/StatsCard';

interface Stats {
    totalUsers: number;
    newUsersToday: number;
    newUsersWeek: number;
    analysesWeek: number;
    pointsSpentWeek: number;
    usersByDay?: Record<string, number>;
    analysesByDay?: Record<string, number>;
    pointsByDay?: Record<string, number>;
}

interface RecentActivity {
    transactions: Array<{ id: string; type?: string; userId?: string; amount?: number; createdAt?: string }>;
    analyses: Array<{ id: string; type?: string; userId?: string; title?: string; createdAt?: string }>;
}

interface HealthStatus {
    firebase?: { name: string; ok: boolean; message: string };
    gemini?: { name: string; ok: boolean; message: string };
    lemonSqueezy?: { name: string; ok: boolean; message: string };
}

const txTypeLabels: Record<string, string> = { purchase: 'Покупка', bonus: 'Бонус', deduction: 'Приспадане' };

export const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [recent, setRecent] = useState<RecentActivity | null>(null);
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetchAdminJson<Stats>('/stats'),
            fetchAdminJson<RecentActivity>('/activity/recent'),
            fetchAdminJson<HealthStatus>('/health').catch(() => null)
        ]).then(([s, r, h]) => {
            setStats(s);
            setRecent(r);
            setHealth(h || null);
        }).catch(() => setStats(null)).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="text-[#888]">Зареждане...</div>;
    if (!stats) return <div className="text-[#c66]">Грешка при зареждане на статистиката</div>;

    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }
    const chartData = days.map(day => ({
        day,
        потребители: stats.usersByDay?.[day] ?? 0,
        анализи: stats.analysesByDay?.[day] ?? 0,
        точки: stats.pointsByDay?.[day] ?? 0
    }));

    return (
        <div className="space-y-8">
            <h1 className="text-xl font-black text-[#C4B091] uppercase tracking-tight">Табло</h1>
            {health && (
                <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
                    <h2 className="text-sm font-black text-[#888] uppercase mb-3">Статус на услугите</h2>
                    <div className="flex flex-wrap gap-4">
                        {[
                            health.firebase,
                            health.gemini,
                            health.lemonSqueezy
                        ].filter(Boolean).map((svc: { name: string; ok: boolean; message: string }) => (
                            <div key={svc.name} className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${svc.ok ? 'bg-[#4a7c59]' : 'bg-[#8b4a4a]'}`} title={svc.message} />
                                <span className="text-sm text-[#ddd]">{svc.name}</span>
                                <span className="text-[10px] text-[#666]">{svc.ok ? 'OK' : svc.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatsCard label="Общо потребители" value={stats.totalUsers} />
                <StatsCard label="Нови днес" value={stats.newUsersToday} />
                <StatsCard label="Нови тази седмица" value={stats.newUsersWeek} />
                <StatsCard label="Анализи тази седмица" value={stats.analysesWeek} />
                <StatsCard label="Изразходвани точки (седмица)" value={stats.pointsSpentWeek} sub="от приспадания" />
            </div>
            {chartData.some(d => d.потребители > 0 || d.анализи > 0 || d.точки > 0) && (
                <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
                    <h2 className="text-sm font-black text-[#888] uppercase mb-4">Активност по дни (последни 7)</h2>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#666" />
                                <YAxis tick={{ fontSize: 10 }} stroke="#666" />
                                <Tooltip contentStyle={{ backgroundColor: '#252525', border: '1px solid #333' }} />
                                <Area type="monotone" dataKey="потребители" stroke="#968B74" fill="#968B74/20" />
                                <Area type="monotone" dataKey="анализи" stroke="#4a7c59" fill="#4a7c59/20" />
                                <Area type="monotone" dataKey="точки" stroke="#C4B091" fill="#C4B091/20" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
            {recent && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
                        <h2 className="text-sm font-black text-[#888] uppercase mb-3">Последни транзакции</h2>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {recent.transactions.length === 0 && <p className="text-[#666] text-sm">Няма транзакции</p>}
                            {recent.transactions.map(t => (
                                <div key={t.id} className="text-sm flex justify-between">
                                    <span className="text-[#ddd]">{txTypeLabels[t.type || ''] || t.type}</span>
                                    <span className="font-bold text-[#C4B091]">{t.amount ?? 0}</span>
                                    <span className="text-[#666] text-[10px]">{(t.createdAt || '').slice(0, 10)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
                        <h2 className="text-sm font-black text-[#888] uppercase mb-3">Последни анализи</h2>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {recent.analyses.length === 0 && <p className="text-[#666] text-sm">Няма анализи</p>}
                            {recent.analyses.map(a => (
                                <div key={a.id} className="text-sm">
                                    <span className="text-[#968B74] font-bold">{a.type || 'link'}</span>
                                    <span className="text-[#666] ml-2">{(a.title || a.id).slice(0, 40)}…</span>
                                    <span className="text-[#666] text-[10px] ml-2">{(a.createdAt || '').slice(0, 10)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
