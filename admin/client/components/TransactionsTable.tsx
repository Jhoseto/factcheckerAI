import React from 'react';

interface Transaction {
    id: string;
    userId?: string;
    type?: string;
    amount?: number;
    description?: string;
    source?: string;
    paymentIntentId?: string;
    createdAt?: string;
}

interface TransactionsTableProps {
    transactions: Transaction[];
}

function getSourceLabel(t: Transaction): string {
    if (t.type === 'deduction') return 'Приспадане';
    if (t.type === 'purchase') return t.source === 'lemonsqueezy' ? 'Покупка (Lemon Squeezy)' : 'Покупка';
    if (t.type === 'bonus') {
        if (t.source === 'lemonsqueezy_test') return 'Бонус (Lemon Squeezy тест)';
        if (t.source === 'manual') return 'Бонус (ръчно)';
        if (t.source === 'welcome') return 'Бонус (при регистрация)';
        return 'Бонус';
    }
    return t.type || '—';
}

export const TransactionsTable: React.FC<TransactionsTableProps> = ({ transactions }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-[#333]">
                    <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Тип / Източник</th>
                    <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Потребител</th>
                    <th className="text-right py-3 px-2 text-[8px] font-black text-[#666] uppercase">Сума</th>
                    <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Дата</th>
                </tr>
            </thead>
            <tbody>
                {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-[#333] hover:bg-[#252525]">
                        <td className="py-3 px-2 text-[#ddd]">{getSourceLabel(t)}</td>
                        <td className="py-3 px-2 text-[#888] text-[10px] font-mono">{(t.userId || '').slice(0, 12)}…</td>
                        <td className="py-3 px-2 text-right font-bold text-[#C4B091]">{t.amount ?? 0}</td>
                        <td className="py-3 px-2 text-[#888] text-[10px]">{(t.createdAt || '').slice(0, 16)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);
