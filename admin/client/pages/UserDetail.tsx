import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchAdmin, fetchAdminJson } from '../api';

const txTypeLabels: Record<string, string> = { purchase: 'Покупка', bonus: 'Бонус', deduction: 'Приспадане' };
const analysisTypeLabels: Record<string, string> = { video: 'Видео', link: 'Линк' };

interface UserDetailData {
    user: { id: string; email?: string; displayName?: string; photoURL?: string; pointsBalance?: number; createdAt?: string; disabled?: boolean };
    transactions: Array<{ id: string; type: string; amount: number; description?: string; createdAt?: string }>;
    analyses: Array<{ id: string; type?: string; title?: string; createdAt?: string }>;
    isAdmin?: boolean;
    isSuperAdminUser?: boolean;
    isSuperAdmin?: boolean;
}

export const UserDetail: React.FC = () => {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<UserDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [pointsAmount, setPointsAmount] = useState('');
    const [pointsReason, setPointsReason] = useState('');
    const [pointsLoading, setPointsLoading] = useState(false);

    useEffect(() => {
        if (!uid) return;
        fetchAdminJson<UserDetailData>(`/users/${uid}`)
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [uid]);

    const handlePoints = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseInt(pointsAmount, 10);
        if (!uid || isNaN(amt) || amt === 0) return;
        setPointsLoading(true);
        try {
            const res = await fetchAdmin(`/users/${uid}/points`, {
                method: 'POST',
                body: JSON.stringify({ amount: amt, reason: pointsReason }),
            });
            if (!res.ok) throw new Error('Failed');
            setPointsAmount('');
            setPointsReason('');
            const refreshed = await fetchAdminJson<UserDetailData>(`/users/${uid}`);
            setData(refreshed);
        } catch {
            // ignore
        } finally {
            setPointsLoading(false);
        }
    };

    if (loading || !data) return <div className="text-[#888]">Зареждане...</div>;
    if (!data.user) return <div className="text-[#c66]">Потребителят не е намерен</div>;

    return (
        <div className="space-y-8">
            <button onClick={() => navigate('/admin/users')} className="text-[9px] font-bold text-[#968B74] hover:text-[#C4B091]">
                ← Назад към потребителите
            </button>
            <div className="flex items-center gap-4">
                {data.user.photoURL ? (
                    <img src={data.user.photoURL} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-[#333]" />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-[#333] flex items-center justify-center text-xl font-bold text-[#888]">
                        {(data.user.displayName || data.user.email || '?').slice(0, 2).toUpperCase()}
                    </div>
                )}
                <h1 className="text-xl font-black text-[#C4B091] uppercase tracking-tight">{data.user.displayName || data.user.email || data.user.id}</h1>
            </div>

            <div className="p-5 bg-[#252525] border border-[#333] rounded-sm space-y-2">
                <p><span className="text-[8px] text-[#666] uppercase">Имейл:</span> {data.user.email || '—'}</p>
                <p><span className="text-[8px] text-[#666] uppercase">Точки:</span> <span className="font-bold text-[#C4B091]">{data.user.pointsBalance ?? 0}</span></p>
                <p><span className="text-[8px] text-[#666] uppercase">Регистрация:</span> {data.user.createdAt || '—'}</p>
                {data.user.disabled && <p><span className="text-[8px] text-[#c66] uppercase">Блокиран</span></p>}
                {data.isSuperAdmin && !data.isSuperAdminUser && (
                    <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[#333]">
                        {data.user.disabled ? (
                            <button
                                onClick={async () => {
                                    if (!uid || !confirm('Отблокирай този потребител?')) return;
                                    const res = await fetchAdmin(`/users/${uid}/unblock`, { method: 'POST' });
                                    if (res.ok) {
                                        const d = await fetchAdminJson<UserDetailData>(`/users/${uid}`);
                                        setData(d);
                                    }
                                }}
                                className="text-[9px] font-bold text-[#4a7c59] hover:text-[#6a9c79]"
                            >
                                Отблокирай
                            </button>
                        ) : (
                            <button
                                onClick={async () => {
                                    if (!uid || !confirm('Блокирай този потребител? Той няма да може да влезе.')) return;
                                    const res = await fetchAdmin(`/users/${uid}/block`, { method: 'POST' });
                                    if (res.ok) {
                                        const d = await fetchAdminJson<UserDetailData>(`/users/${uid}`);
                                        setData(d);
                                    }
                                }}
                                className="text-[9px] font-bold text-[#c66] hover:text-[#e88]"
                            >
                                Блокирай
                            </button>
                        )}
                        {data.isAdmin ? (
                            <button
                                onClick={async () => {
                                    if (!uid || !confirm('Понижи този потребител от администратор?')) return;
                                    const res = await fetchAdmin(`/users/${uid}/demote`, { method: 'POST' });
                                    if (res.ok) {
                                        const d = await fetchAdminJson<UserDetailData>(`/users/${uid}`);
                                        setData(d);
                                    }
                                }}
                                className="text-[9px] font-bold text-[#c66] hover:text-[#e88]"
                            >
                                Понижи от администратор
                            </button>
                        ) : (
                            <button
                                onClick={async () => {
                                    if (!uid || !confirm('Повиши този потребител в администратор?')) return;
                                    const res = await fetchAdmin(`/users/${uid}/promote`, { method: 'POST' });
                                    if (res.ok) {
                                        const d = await fetchAdminJson<UserDetailData>(`/users/${uid}`);
                                        setData(d);
                                    }
                                }}
                                className="text-[9px] font-bold text-[#968B74] hover:text-[#C4B091]"
                            >
                                Повиши в администратор
                            </button>
                        )}
                    </div>
                )}
            </div>

            <form onSubmit={handlePoints} className="p-5 bg-[#252525] border border-[#333] rounded-sm flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-[8px] text-[#666] uppercase mb-1">Точки (+/-)</label>
                    <input
                        type="number"
                        value={pointsAmount}
                        onChange={e => setPointsAmount(e.target.value)}
                        placeholder="напр. 50 или -20"
                        className="px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-[#ddd] w-32"
                    />
                </div>
                <div>
                    <label className="block text-[8px] text-[#666] uppercase mb-1">Причина</label>
                    <input
                        type="text"
                        value={pointsReason}
                        onChange={e => setPointsReason(e.target.value)}
                        placeholder="Административна корекция"
                        className="px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-[#ddd] w-48"
                    />
                </div>
                <button type="submit" disabled={pointsLoading} className="px-4 py-2 bg-[#968B74] text-[#1a1a1a] text-[9px] font-bold uppercase rounded hover:bg-[#a69b7a] disabled:opacity-50">
                    Приложи
                </button>
            </form>

            <div>
                <h2 className="text-sm font-black text-[#888] uppercase mb-3">Транзакции</h2>
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-[#333]"><th className="text-left py-2 text-[8px] text-[#666]">Тип</th><th className="text-right py-2 text-[8px] text-[#666]">Сума</th><th className="text-left py-2 text-[8px] text-[#666]">Дата</th></tr></thead>
                        <tbody>
                            {data.transactions.slice(0, 20).map(t => (
                                <tr key={t.id} className="border-b border-[#333]">
                                    <td className="py-2 text-[#ddd]">{txTypeLabels[t.type] || t.type}</td>
                                    <td className="py-2 text-right font-bold">{t.amount > 0 ? '+' : ''}{t.amount}</td>
                                    <td className="py-2 text-[#888] text-[10px]">{(t.createdAt || '').slice(0, 16)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div>
                <h2 className="text-sm font-black text-[#888] uppercase mb-3">Анализи</h2>
                <div className="space-y-2">
                    {data.analyses.slice(0, 10).map(a => (
                        <div key={a.id} className="p-3 bg-[#252525] border border-[#333] rounded text-sm">
                            <span className="text-[#968B74] font-bold">{analysisTypeLabels[a.type || 'link'] || a.type || 'Линк'}</span> — {(a.title || a.id).slice(0, 60)} — {(a.createdAt || '').slice(0, 10)}
                        </div>
                    ))}
                    {data.analyses.length === 0 && <p className="text-[#666]">Няма анализи</p>}
                </div>
            </div>
        </div>
    );
};
