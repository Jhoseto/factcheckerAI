import React, { useEffect, useState } from 'react';
import { fetchAdminJson } from '../api';
import { TransactionsTable } from '../components/TransactionsTable';

interface Transaction {
    id: string;
    userId?: string;
    type?: string;
    amount?: number;
    description?: string;
    source?: string;
    createdAt?: string;
}

export const Transactions: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('');

    useEffect(() => {
        const q = typeFilter ? `?type=${encodeURIComponent(typeFilter)}` : '';
        fetchAdminJson<{ transactions: Transaction[] }>(`/transactions${q}`)
            .then(d => setTransactions(d.transactions || []))
            .catch(() => setTransactions([]))
            .finally(() => setLoading(false));
    }, [typeFilter]);

    const getSourceLabel = (t: Transaction) => {
        if (t.type === 'deduction') return 'Приспадане';
        if (t.type === 'purchase') return t.source === 'lemonsqueezy' ? 'Покупка (Lemon Squeezy)' : 'Покупка';
        if (t.type === 'bonus') {
            if (t.source === 'lemonsqueezy_test') return 'Бонус (Lemon Squeezy тест)';
            if (t.source === 'manual') return 'Бонус (ръчно)';
            if (t.source === 'welcome') return 'Бонус (при регистрация)';
            return 'Бонус';
        }
        return t.type || '';
    };

    const exportCsv = () => {
        const headers = ['ID', 'Тип / Източник', 'Потребител', 'Сума', 'Дата'];
        const rows = transactions.map(t => [
            t.id,
            getSourceLabel(t),
            t.userId || '',
            String(t.amount ?? 0),
            (t.createdAt || '').slice(0, 16)
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-black text-[#C4B091] uppercase tracking-tight">Транзакции</h1>
            <div className="flex gap-4">
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="px-4 py-2 bg-[#252525] border border-[#333] rounded text-sm text-[#ddd]"
                >
                    <option value="">Всички типове</option>
                    <option value="purchase">Покупка (реални)</option>
                    <option value="bonus">Бонус (ръчно / тест / регистрация)</option>
                    <option value="deduction">Приспадане</option>
                </select>
                <button onClick={exportCsv} disabled={transactions.length === 0} className="px-4 py-2 bg-[#333] text-[#888] text-[9px] font-bold uppercase rounded hover:bg-[#444] hover:text-[#ddd] disabled:opacity-50">
                    Експорт CSV
                </button>
            </div>
            {loading ? <div className="text-[#888]">Зареждане...</div> : <TransactionsTable transactions={transactions} />}
        </div>
    );
};
