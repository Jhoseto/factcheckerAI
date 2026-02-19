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

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const filteredTransactions = transactions
        .filter(t => {
            // 1. Filter by Type
            if (filter !== 'all') {
                if (filter === 'purchase') {
                    if (t.type !== 'purchase' && t.type !== 'bonus') return false;
                } else if (filter === 'deduction') {
                    if (t.type !== 'deduction') return false;
                } else if (filter === 'video') {
                    // Check if it's a video analysis (YouTube link or video file)
                    const isVideo = t.metadata?.videoId || t.description?.toLowerCase().includes('видео') || t.metadata?.videoTitle;
                    if (!isVideo) return false;
                } else if (filter === 'link') {
                    // Check if it's a link analysis
                    const isLink = t.description?.includes('Линк') || t.description?.includes('статия') || (t.type === 'deduction' && !t.metadata?.videoId && !t.description?.includes('видео'));
                    if (!isLink) return false;
                } else if (filter === 'social') {
                    // Future proofing for social
                    const isSocial = t.description?.includes('social') || t.description?.includes('пост') || t.description?.includes('коментар');
                    if (!isSocial) return false;
                }
            }

            // 2. Search
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const title = t.metadata?.videoTitle?.toLowerCase() || '';
                const author = t.metadata?.videoAuthor?.toLowerCase() || '';
                const desc = t.description?.toLowerCase() || '';
                return title.includes(term) || author.includes(term) || desc.includes(term);
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
            <div className="flex h-full items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-900"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm">
                <div className="flex justify-between items-center max-w-6xl mx-auto">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                            История на разходите
                        </h1>
                        <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">
                            Проследете движението на вашите точки
                        </p>
                    </div>
                    <div className="bg-slate-100 rounded-sm px-4 py-2 border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Баланс</span>
                        <span className="text-xl font-black text-slate-900">{userProfile?.points?.toLocaleString() || 0}</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto px-8 py-8">
                <div className="max-w-4xl mx-auto space-y-6">

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-sm border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Общо изразходени</p>
                            <p className="text-2xl font-black text-amber-900">
                                {Math.abs(transactions.filter(t => t.type === 'deduction').reduce((acc, curr) => acc + curr.amount, 0)).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-sm border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Общо закупени</p>
                            <p className="text-2xl font-black text-emerald-600">
                                {transactions.filter(t => t.type === 'purchase').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-sm border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Брой транзакции</p>
                            <p className="text-2xl font-black text-slate-700">{transactions.length}</p>
                        </div>
                    </div>

                    {/* Controls Bar: Search, Filter, Sort */}
                    <div className="flex flex-col xl:flex-row gap-4 justify-between items-center bg-white p-4 rounded-sm border border-slate-100 shadow-sm">
                        {/* Filters */}
                        <div className="flex flex-wrap gap-2 justify-center xl:justify-start">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors rounded-sm ${filter === 'all'
                                    ? 'bg-amber-900 text-white'
                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                    }`}
                            >
                                Всички
                            </button>
                            <button
                                onClick={() => setFilter('purchase')}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors rounded-sm ${filter === 'purchase'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                    }`}
                            >
                                Зареждания
                            </button>
                            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                            <button
                                onClick={() => setFilter('video')}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors rounded-sm ${filter === 'video'
                                    ? 'bg-amber-900 text-white'
                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                    }`}
                            >
                                Видео
                            </button>
                            <button
                                onClick={() => setFilter('link')}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors rounded-sm ${filter === 'link'
                                    ? 'bg-amber-900 text-white'
                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                    }`}
                            >
                                Линкове
                            </button>
                            <button
                                onClick={() => setFilter('social')}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors rounded-sm ${filter === 'social'
                                    ? 'bg-amber-900 text-white'
                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                    }`}
                            >
                                Социални
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative w-full md:w-64">
                            <input
                                type="text"
                                placeholder="Търсене по име..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-amber-900 placeholder:text-slate-400 transition-colors uppercase"
                            />
                            <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Sort */}
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as any)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 focus:outline-none focus:border-amber-900 uppercase tracking-wide cursor-pointer"
                        >
                            <option value="date_desc">Най-нови</option>
                            <option value="date_asc">Най-стари</option>
                            <option value="points_desc">Най-скъпи</option>
                        </select>
                    </div>

                    {/* Transactions List */}
                    <div className="space-y-3">
                        {filteredTransactions.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-sm border border-slate-100">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <p className="text-sm text-slate-500 font-medium">Няма намерени транзакции</p>
                            </div>
                        ) : (
                            filteredTransactions.map((tx) => (
                                <div
                                    key={tx.id}
                                    className="group bg-white p-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-100 transition-all flex flex-col md:flex-row gap-4 items-center editorial-card"
                                >
                                    {/* Thumbnail / Icon */}
                                    <div className="flex-shrink-0">
                                        {tx.metadata?.thumbnailUrl ? (
                                            <div className="w-16 h-16 md:w-20 md:h-12 relative overflow-hidden rounded-sm bg-slate-100">
                                                <img
                                                    src={tx.metadata.thumbnailUrl}
                                                    alt="Video Thumbnail"
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                                {tx.metadata.videoDuration && (
                                                    <div className="absolute bottom-0.5 right-0.5 bg-black/80 text-[8px] text-white px-1 rounded-sm font-bold">
                                                        {formatDuration(tx.metadata.videoDuration)}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tx.type === 'deduction' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'
                                                }`}>
                                                {tx.type === 'deduction' ? (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 text-center md:text-left">
                                        {tx.metadata?.videoTitle ? (
                                            <div className="space-y-1">
                                                <a
                                                    href={tx.metadata.videoId ? `https://youtube.com/watch?v=${tx.metadata.videoId}` : '#'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm font-black text-slate-900 group-hover:text-amber-900 transition-colors line-clamp-2 leading-tight"
                                                >
                                                    {tx.metadata.videoTitle}
                                                </a>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                    {tx.metadata.videoAuthor && <span className="text-slate-800">{tx.metadata.videoAuthor}</span>}
                                                    {tx.metadata.videoAuthor && <span className="mx-2 text-slate-300">•</span>}
                                                    {new Date(tx.createdAt).toLocaleDateString('bg-BG', {
                                                        day: 'numeric',
                                                        month: 'long',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                                                    {tx.description}
                                                </h4>
                                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                                                    {new Date(tx.createdAt).toLocaleDateString('bg-BG', {
                                                        day: 'numeric',
                                                        month: 'long',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Amount */}
                                    <div className="text-right flex-shrink-0 flex flex-col items-center md:items-end">
                                        <p className={`text-lg font-black tracking-tight ${tx.type === 'deduction' ? 'text-red-500' : 'text-emerald-600'
                                            }`}>
                                            {tx.type === 'deduction' ? '-' : '+'}{Math.abs(tx.amount).toLocaleString()}
                                        </p>
                                        <p className="text-[9px] font-bold opacity-60 uppercase">
                                            точки
                                        </p>
                                        {tx.type === 'deduction' && tx.analysisId && (
                                            <div className="mt-1 text-[9px] text-slate-300 font-mono">
                                                ID: {tx.analysisId.substring(0, 6)}...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="text-center pt-8">
                        <button
                            onClick={() => navigate('/')}
                            className="text-[10px] font-bold text-slate-400 hover:text-amber-900 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto"
                        >
                            ← Обратно към анализатора
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpensesPage;
