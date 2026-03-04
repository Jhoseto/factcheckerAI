import React, { useEffect, useState } from 'react';
import { fetchAdminJson } from '../api';
import { UsersTable } from '../components/UsersTable';

interface UsersResponse {
    users: Array<{ id: string; email?: string; displayName?: string; pointsBalance?: number; createdAt?: string }>;
}

export const Users: React.FC = () => {
    const [users, setUsers] = useState<UsersResponse['users']>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const load = () => {
        setLoading(true);
        const q = search ? `?q=${encodeURIComponent(search)}` : '';
        fetchAdminJson<UsersResponse>(`/users${q}`)
            .then(d => setUsers(d.users || []))
            .catch(() => setUsers([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, [search]);

    const exportCsv = () => {
        const headers = ['ID', 'Имейл', 'Име', 'Точки', 'Регистрация'];
        const rows = users.map(u => [
            u.id,
            u.email || '',
            u.displayName || '',
            String(u.pointsBalance ?? 0),
            (u.createdAt || '').slice(0, 10)
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-black text-[#C4B091] uppercase tracking-tight">Потребители</h1>
            <div className="flex gap-4">
                <input
                    type="text"
                    placeholder="Търсене по имейл или име..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="px-4 py-2 bg-[#252525] border border-[#333] rounded text-sm text-[#ddd] placeholder-[#666]"
                />
                <button onClick={exportCsv} disabled={users.length === 0} className="px-4 py-2 bg-[#333] text-[#888] text-[9px] font-bold uppercase rounded hover:bg-[#444] hover:text-[#ddd] disabled:opacity-50">
                    Експорт CSV
                </button>
            </div>
            {loading ? <div className="text-[#888]">Зареждане...</div> : <UsersTable users={users} />}
        </div>
    );
};
