import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getUserTransactions, Transaction } from '../../services/transactionService';

const ExpensesPage: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'deduction' | 'purchase' | 'video' | 'link' | 'social'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'points_desc'>('date_desc');

    useEffect(() => {
        if (!currentUser) return;
        const loadTransactions = async () => {
            try {
                const txs = await getUserTransactions(currentUser.uid);
                setTransactions(txs);
            } catch (error) {
                console.error("Error loading transactions:", error);
            } finally {
                setLoading(false);
            }
        };
        loadTransactions();
    }, [currentUser]);

    const filteredTransactions = transactions
        .filter(t => {
            if (filter !== 'all') {
                if (filter === 'purchase') { if (t.type !== 'purchase' && t.type !== 'bonus') return false; }
                else if (filter === 'deduction') { if (t.type !== 'deduction') return false; }
                else if (filter === 'video') { if (!t.metadata?.videoId && !t.description?.toLowerCase().includes('video')) return false; }
            }
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (t.metadata?.videoTitle?.toLowerCase() || '').includes(term) || (t.description?.toLowerCase() || '').includes(term);
            }
            return true;
        })
        .sort((a, b) => {
            if (sortOrder === 'date_desc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (sortOrder === 'date_asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            if (sortOrder === 'points_desc') return Math.abs(b.amount) - Math.abs(a.amount);
            return 0;
        });

    if (loading) {
        return (
             <div className="min-h-screen bg-[#222] flex items-center justify-center">
                <div className="w-12 h-12 border-[1px] border-[#333] border-t-[#968B74] rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden pt-40 pb-24">
             <div className="premium-bg-wrapper">
                <div className="premium-wave-1"></div>
                <div className="premium-wave-2"></div>
                <div className="premium-wave-3"></div>
                <div className="premium-texture"></div>
            </div>

            <div className="max-w-6xl mx-auto px-8 relative z-10 animate-fadeUp">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end border-b border-[#968B74]/20 pb-8 mb-12 gap-6">
                    <div>
                        <h1 className="text-4xl font-serif text-[#E0E0E0] tracking-tight">
                            ИСТОРИЯ НА <span className="text-bronze-gradient italic">ТРАНЗАКЦИИТЕ</span>
                        </h1>
                        <p className="text-[9px] text-[#666] font-bold mt-3 uppercase tracking-[0.3em] flex items-center gap-2">
                            <span className="w-2 h-2 bg-[#968B74] rounded-full"></span>
                            Проверен регистър
                        </p>
                    </div>
                    <div className="bg-[#252525] rounded px-8 py-4 border border-[#333] shadow-lg flex flex-col items-end">
                        <span className="text-[8px] font-bold text-[#666] uppercase tracking-[0.2em] mb-1">Налични Точки</span>
                        <span className="text-3xl font-serif text-bronze-gradient">{userProfile?.pointsBalance?.toLocaleString() ?? 0}</span>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-[#252525] p-6 rounded border border-[#333]">
                        <p className="text-[9px] font-bold text-[#666] uppercase tracking-[0.2em] mb-2">Общо Изразходени</p>
                        <p className="text-2xl font-serif text-[#968B74]">
                            {Math.abs(transactions.filter(t => t.type === 'deduction').reduce((acc, curr) => acc + curr.amount, 0)).toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-[#252525] p-6 rounded border border-[#333]">
                        <p className="text-[9px] font-bold text-[#666] uppercase tracking-[0.2em] mb-2">Общо Закупени</p>
                        <p className="text-2xl font-serif text-emerald-500">
                            {transactions.filter(t => t.type === 'purchase').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-[#252525] p-6 rounded border border-[#333]">
                        <p className="text-[9px] font-bold text-[#666] uppercase tracking-[0.2em] mb-2">Операции</p>
                        <p className="text-2xl font-serif text-[#E0E0E0]">{transactions.length}</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col xl:flex-row gap-6 justify-between items-center bg-[#252525] p-6 rounded border border-[#333] mb-8">
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'all', label: 'Всички' },
                            { id: 'purchase', label: 'Покупки' },
                            { id: 'video', label: 'Видео Одит' },
                            { id: 'link', label: 'Линк Одит' }
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setFilter(opt.id as any)}
                                className={`px-5 py-2 text-[8px] font-bold uppercase tracking-[0.2em] transition-all rounded-sm ${filter === opt.id
                                    ? 'bg-[#968B74] text-[#1a1a1a]'
                                    : 'bg-[#1a1a1a] text-[#666] border border-[#333] hover:border-[#968B74] hover:text-[#968B74]'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="ТЪРСЕНЕ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-luxury px-4 py-2 text-[10px] uppercase tracking-wider w-full md:w-64 rounded-sm placeholder:text-[#444]"
                        />
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as any)}
                            className="input-luxury px-4 py-2 text-[10px] uppercase tracking-wider rounded-sm cursor-pointer"
                        >
                            <option value="date_desc">Най-нови</option>
                            <option value="date_asc">Най-стари</option>
                            <option value="points_desc">Стойност</option>
                        </select>
                    </div>
                </div>

                {/* List */}
                <div className="space-y-4">
                    {filteredTransactions.length === 0 ? (
                        <div className="text-center py-24 border border-[#333] border-dashed rounded opacity-30">
                            <p className="text-[10px] uppercase tracking-[0.3em] text-[#888]">Няма намерени записи</p>
                        </div>
                    ) : (
                        filteredTransactions.map((tx) => (
                            <div
                                key={tx.id}
                                className="group bg-[#252525] p-6 border border-[#333] hover:border-[#968B74]/40 transition-all duration-500 flex flex-col md:flex-row gap-8 items-center relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#333] group-hover:bg-[#968B74] transition-colors duration-500"></div>
                                
                                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-[#1a1a1a] border border-[#333] group-hover:border-[#968B74]/20 transition-colors">
                                    <span className={`text-lg ${tx.type === 'deduction' ? 'text-[#666] group-hover:text-[#968B74]' : 'text-emerald-500'}`}>
                                        {tx.type === 'deduction' ? '↘' : '↗'}
                                    </span>
                                </div>

                                <div className="flex-1 min-w-0 text-center md:text-left space-y-2">
                                    <h4 className="text-sm font-serif text-[#E0E0E0] group-hover:text-[#968B74] transition-colors line-clamp-1">
                                        {tx.metadata?.videoTitle || tx.description}
                                    </h4>
                                    <p className="text-[9px] text-[#555] font-mono uppercase tracking-[0.15em]">
                                        {new Date(tx.createdAt).toLocaleDateString('bg-BG')} • {new Date(tx.createdAt).toLocaleTimeString('bg-BG')} • ID: {tx.id.slice(0,8)}
                                    </p>
                                </div>

                                <div className="text-right flex-shrink-0 flex flex-col items-center md:items-end min-w-[120px]">
                                    <p className={`text-xl font-serif tracking-tighter ${tx.type === 'deduction' ? 'text-[#968B74]' : 'text-emerald-500'}`}>
                                        {tx.type === 'deduction' ? '-' : '+'}{Math.abs(tx.amount).toLocaleString()}
                                    </p>
                                    <p className="text-[8px] font-bold text-[#444] uppercase tracking-[0.3em]">Точки</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExpensesPage;
