import React, { useEffect, useState } from 'react';
import { fetchAdmin, fetchAdminJson } from '../api';
import { AdminsTable } from '../components/AdminsTable';

const SUPER_ADMIN_EMAIL = 'sereliev@gmail.com';

interface Admin {
    uid: string;
    email?: string;
    promotedAt?: string;
    promotedBy?: string;
}

export const Admins: React.FC = () => {
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [promoteEmail, setPromoteEmail] = useState('');
    const [promoteLoading, setPromoteLoading] = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    const load = () => {
        fetchAdminJson<{ admins: Admin[] }>('/admins')
            .then(d => setAdmins(d.admins || []))
            .catch(() => setAdmins([]));
    };

    useEffect(() => {
        Promise.all([
            fetchAdminJson<{ isSuperAdmin?: boolean }>('/verify'),
            fetchAdminJson<{ admins: Admin[] }>('/admins')
        ]).then(([v, a]) => {
            setIsSuperAdmin(!!v.isSuperAdmin);
            setAdmins(a.admins || []);
        }).catch(() => setAdmins([])).finally(() => setLoading(false));
    }, []);

    const handleDemote = async (uid: string) => {
        if (!confirm('Понижи този администратор?')) return;
        try {
            const res = await fetchAdmin(`/users/${uid}/demote`, { method: 'POST' });
            if (res.ok) load();
        } catch { /* ignore */ }
    };

    const handlePromote = async (e: React.FormEvent) => {
        e.preventDefault();
        const email = promoteEmail.trim().toLowerCase();
        if (!email) return;
        setPromoteLoading(true);
        try {
            const res = await fetchAdmin('/users/promote-by-email', {
                method: 'POST',
                body: JSON.stringify({ email }),
            });
            if (res.ok) {
                setPromoteEmail('');
                load();
            } else {
                const data = await res.json().catch(() => ({}));
                alert((data as { error?: string }).error || 'Грешка');
            }
        } catch (err) {
            alert('Грешка при повишаване');
        } finally {
            setPromoteLoading(false);
        }
    };

    if (loading) return <div className="text-[#888]">Зареждане...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-black text-[#C4B091] uppercase tracking-tight">Администратори</h1>
            {isSuperAdmin && (
                <form onSubmit={handlePromote} className="p-5 bg-[#252525] border border-[#333] rounded-sm flex gap-4 items-end">
                    <div>
                        <label className="block text-[8px] text-[#666] uppercase mb-1">Повиши по имейл</label>
                        <input
                            type="email"
                            value={promoteEmail}
                            onChange={e => setPromoteEmail(e.target.value)}
                            placeholder="потребител@example.com"
                            className="px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-[#ddd] w-64"
                        />
                    </div>
                    <button type="submit" disabled={promoteLoading} className="px-4 py-2 bg-[#968B74] text-[#1a1a1a] text-[9px] font-bold uppercase rounded hover:bg-[#a69b7a] disabled:opacity-50">
                        Повиши
                    </button>
                </form>
            )}
            <AdminsTable admins={admins} onDemote={handleDemote} isSuperAdmin={isSuperAdmin} superAdminEmail={SUPER_ADMIN_EMAIL} />
        </div>
    );
};
