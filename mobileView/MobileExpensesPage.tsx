import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserTransactions, Transaction } from '../services/transactionService';
import MobileSafeArea from './components/MobileSafeArea';
import MobileHeader from './components/MobileHeader';

const MobileExpensesPage: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'deductions' | 'purchases'>('deductions');
  const [filter, setFilter] = useState<'all' | 'video' | 'link' | 'social'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'points_desc' | 'video' | 'link'>('date_desc');

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
      // 1. Filter by Tab (deductions or purchases)
      if (activeTab === 'deductions') {
        if (t.type !== 'deduction') return false;
      } else if (activeTab === 'purchases') {
        if (t.type !== 'purchase' && t.type !== 'bonus') return false;
      }

      // 2. Filter by Type (video, link, social)
      if (filter !== 'all') {
        if (filter === 'video') {
          const isVideo = t.metadata?.videoId || t.description?.toLowerCase().includes('видео') || t.metadata?.videoTitle;
          if (!isVideo) return false;
        } else if (filter === 'link') {
          const isLink = t.description?.includes('Линк') || t.description?.includes('статия') || (t.type === 'deduction' && !t.metadata?.videoId && !t.description?.includes('видео'));
          if (!isLink) return false;
        } else if (filter === 'social') {
          const isSocial = t.description?.includes('social') || t.description?.includes('пост') || t.description?.includes('коментар');
          if (!isSocial) return false;
        }
      }

      // 3. Search
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
      if (sortOrder === 'video') {
        const aIsVideo = a.metadata?.videoId || a.description?.toLowerCase().includes('видео') || a.metadata?.videoTitle;
        const bIsVideo = b.metadata?.videoId || b.description?.toLowerCase().includes('видео') || b.metadata?.videoTitle;
        if (aIsVideo && !bIsVideo) return -1;
        if (!aIsVideo && bIsVideo) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortOrder === 'link') {
        const aIsLink = a.description?.includes('Линк') || a.description?.includes('статия') || (a.type === 'deduction' && !a.metadata?.videoId && !a.description?.includes('видео'));
        const bIsLink = b.description?.includes('Линк') || b.description?.includes('статия') || (b.type === 'deduction' && !b.metadata?.videoId && !b.description?.includes('видео'));
        if (aIsLink && !bIsLink) return -1;
        if (!aIsLink && bIsLink) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });

  if (loading) {
    return (
      <MobileSafeArea>
        <MobileHeader title="История на точките" />
        <div className="flex h-full items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-900"></div>
        </div>
      </MobileSafeArea>
    );
  }

  return (
    <MobileSafeArea>
      <MobileHeader title="История на точките" />
      <main className="flex flex-col flex-1 px-4 pt-6 pb-8 overflow-y-auto">
        {/* Balance Display */}
        <div className="bg-white rounded-xl p-4 mb-4 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Баланс</p>
              <p className="text-2xl font-black text-slate-900">{userProfile?.pointsBalance?.toLocaleString() ?? 0}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                {activeTab === 'deductions' ? 'Похарчени' : 'Заредени'}
              </p>
              <p className="text-2xl font-black text-slate-700">
                {activeTab === 'deductions' 
                  ? transactions.filter(t => t.type === 'deduction').length
                  : transactions.filter(t => t.type === 'purchase' || t.type === 'bonus').length
                }
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Изразходени</p>
            <p className="text-lg font-black text-amber-900">
              {Math.abs(transactions.filter(t => t.type === 'deduction').reduce((acc, curr) => acc + curr.amount, 0)).toLocaleString()}
            </p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Закупени</p>
            <p className="text-lg font-black text-emerald-600">
              {transactions.filter(t => t.type === 'purchase').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2 bg-slate-50 p-1 rounded-xl">
          <button
            onClick={() => {
              setActiveTab('deductions');
              setFilter('all');
            }}
            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors rounded-lg ${
              activeTab === 'deductions'
                ? 'bg-white text-amber-900 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Похарчени
          </button>
          <button
            onClick={() => {
              setActiveTab('purchases');
              setFilter('all');
            }}
            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors rounded-lg ${
              activeTab === 'purchases'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Заредени
          </button>
        </div>

        {/* Filters */}
        {activeTab === 'deductions' && (
          <div className="mb-4 overflow-x-auto -mx-4 px-4">
            <div className="flex gap-2 min-w-max">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-colors rounded-lg whitespace-nowrap ${
                  filter === 'all'
                    ? 'bg-amber-900 text-white'
                    : 'bg-slate-50 text-slate-400'
                }`}
              >
                Всички
              </button>
              <button
                onClick={() => setFilter('video')}
                className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-colors rounded-lg whitespace-nowrap ${
                  filter === 'video'
                    ? 'bg-amber-900 text-white'
                    : 'bg-slate-50 text-slate-400'
                }`}
              >
                Видео
              </button>
              <button
                onClick={() => setFilter('link')}
                className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-colors rounded-lg whitespace-nowrap ${
                  filter === 'link'
                    ? 'bg-amber-900 text-white'
                    : 'bg-slate-50 text-slate-400'
                }`}
              >
                Линкове
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Търсене..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-900 placeholder:text-slate-400"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Sort */}
        <div className="mb-4">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:border-amber-900 uppercase tracking-wide"
          >
            <option value="date_desc">Най-нови</option>
            <option value="date_asc">Най-стари</option>
            <option value="points_desc">Най-скъпи</option>
            <option value="video">Видео</option>
            <option value="link">Линкове</option>
          </select>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
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
                className="bg-white p-4 border border-slate-100 rounded-xl shadow-sm flex gap-3"
              >
                {/* Thumbnail / Icon */}
                <div className="flex-shrink-0">
                  {tx.metadata?.thumbnailUrl ? (
                    <div className="w-16 h-12 relative overflow-hidden rounded-lg bg-slate-100">
                      <img
                        src={tx.metadata.thumbnailUrl}
                        alt="Video Thumbnail"
                        className="w-full h-full object-cover"
                      />
                      {tx.metadata.videoDuration && (
                        <div className="absolute bottom-0.5 right-0.5 bg-black/80 text-[8px] text-white px-1 rounded font-bold">
                          {formatDuration(tx.metadata.videoDuration as number)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      tx.type === 'deduction' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'
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
                <div className="flex-1 min-w-0">
                  {tx.metadata?.videoTitle ? (
                    <div className="space-y-1">
                      <a
                        href={tx.metadata.videoId ? `https://youtube.com/watch?v=${tx.metadata.videoId}` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-black text-slate-900 line-clamp-2 leading-tight block"
                      >
                        {tx.metadata.videoTitle}
                      </a>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                        {tx.metadata.videoAuthor && <span className="text-slate-800">{tx.metadata.videoAuthor}</span>}
                        {tx.metadata.videoAuthor && <span className="mx-2 text-slate-300">•</span>}
                        {new Date(tx.createdAt).toLocaleDateString('bg-BG', {
                          day: 'numeric',
                          month: 'short',
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
                      <p className="text-[9px] text-slate-400 font-medium uppercase tracking-widest">
                        {new Date(tx.createdAt).toLocaleDateString('bg-BG', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0 flex flex-col justify-center">
                  <p className={`text-lg font-black tracking-tight ${
                    tx.type === 'deduction' ? 'text-red-500' : 'text-emerald-600'
                  }`}>
                    {tx.type === 'deduction' ? '-' : '+'}{Math.abs(tx.amount).toLocaleString()}
                  </p>
                  <p className="text-[8px] font-bold opacity-60 uppercase">
                    точки
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </MobileSafeArea>
  );
};

export default MobileExpensesPage;
