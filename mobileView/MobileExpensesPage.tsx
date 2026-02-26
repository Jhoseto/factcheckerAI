import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { getUserTransactions, Transaction } from '../services/transactionService';
import MobileSafeArea from './components/MobileSafeArea';
import MobileHeader from './components/MobileHeader';

const dateLocale = (lng: string) => (lng === 'en' || lng?.startsWith('en') ? 'en-GB' : 'bg-BG');

const MobileExpensesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const locale = dateLocale(i18n.language);
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
      <MobileSafeArea className="bg-[#1a1a1a]">
        <MobileHeader title={t('mobile.pointsHistory')} />
        <div className="flex h-full items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#333] border-t-[#968B74]"></div>
        </div>
      </MobileSafeArea>
    );
  }

  return (
    <MobileSafeArea className="bg-[#1a1a1a]">
      <MobileHeader title={t('mobile.pointsHistory')} />
      <main className="flex flex-col flex-1 px-4 pt-6 pb-24 overflow-y-auto overscroll-contain">
        {/* Balance Display */}
        <div className="bg-[#252525] rounded-xl p-4 mb-4 border border-[#333]">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1">{t('mobile.balance')}</p>
              <p className="text-2xl font-black text-[#E0E0E0]">{userProfile?.pointsBalance?.toLocaleString() ?? 0}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1">
                {activeTab === 'deductions' ? t('mobile.spent') : t('mobile.loaded')}
              </p>
              <p className="text-2xl font-black text-[#ccc]">
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
          <div className="bg-[#252525] p-3 rounded-xl border border-[#333]">
            <p className="text-[9px] font-bold text-[#888] uppercase tracking-widest mb-1">{t('mobile.spentTotal')}</p>
            <p className="text-lg font-black text-[#C4B091]">
              {Math.abs(transactions.filter(t => t.type === 'deduction').reduce((acc, curr) => acc + curr.amount, 0)).toLocaleString()}
            </p>
          </div>
          <div className="bg-[#252525] p-3 rounded-xl border border-[#333]">
            <p className="text-[9px] font-bold text-[#888] uppercase tracking-widest mb-1">{t('mobile.purchasedTotal')}</p>
            <p className="text-lg font-black text-emerald-400">
              {transactions.filter(t => t.type === 'purchase').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2 bg-[#252525] p-1 rounded-xl border border-[#333]">
          <button
            onClick={() => {
              setActiveTab('deductions');
              setFilter('all');
            }}
            className={`flex-1 min-h-[44px] py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors rounded-lg touch-manipulation ${
              activeTab === 'deductions'
                ? 'bg-[#968B74] text-[#1a1a1a]'
                : 'text-[#888]'
            }`}
          >
            {t('mobile.spent')}
          </button>
          <button
            onClick={() => {
              setActiveTab('purchases');
              setFilter('all');
            }}
            className={`flex-1 min-h-[44px] py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors rounded-lg touch-manipulation ${
              activeTab === 'purchases'
                ? 'bg-emerald-700/60 text-white'
                : 'text-[#888]'
            }`}
          >
            {t('mobile.loaded')}
          </button>
        </div>

        {/* Filters */}
        {activeTab === 'deductions' && (
          <div className="mb-4 overflow-x-auto -mx-4 px-4 mobile-no-scrollbar">
            <div className="flex gap-2 min-w-max pb-1">
              <button
                onClick={() => setFilter('all')}
                className={`min-h-[44px] px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors rounded-lg whitespace-nowrap touch-manipulation ${
                  filter === 'all'
                    ? 'bg-[#968B74] text-[#1a1a1a]'
                    : 'bg-[#252525] text-[#888] border border-[#333]'
                }`}
              >
                {t('archive.all')}
              </button>
              <button
                onClick={() => setFilter('video')}
                className={`min-h-[44px] px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors rounded-lg whitespace-nowrap touch-manipulation ${
                  filter === 'video'
                    ? 'bg-[#968B74] text-[#1a1a1a]'
                    : 'bg-[#252525] text-[#888] border border-[#333]'
                }`}
              >
                {t('mobile.filterVideo')}
              </button>
              <button
                onClick={() => setFilter('link')}
                className={`min-h-[44px] px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors rounded-lg whitespace-nowrap touch-manipulation ${
                  filter === 'link'
                    ? 'bg-[#968B74] text-[#1a1a1a]'
                    : 'bg-[#252525] text-[#888] border border-[#333]'
                }`}
              >
                {t('mobile.filterLinks')}
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder={t('mobile.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[44px] pl-10 pr-4 py-3 bg-[#252525] border border-[#333] rounded-xl text-sm font-medium text-[#E0E0E0] focus:outline-none focus:border-[#968B74] placeholder:text-[#666]"
          />
          <svg className="w-4 h-4 text-[#666] absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Sort */}
        <div className="mb-4">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="w-full min-h-[44px] px-3 py-3 bg-[#252525] border border-[#333] rounded-xl text-sm font-bold text-[#E0E0E0] focus:outline-none focus:border-[#968B74] uppercase tracking-wide"
          >
            <option value="date_desc">{t('mobile.sortNewest')}</option>
            <option value="date_asc">{t('mobile.sortOldest')}</option>
            <option value="points_desc">{t('mobile.sortByPoints')}</option>
            <option value="video">{t('mobile.filterVideo')}</option>
            <option value="link">{t('mobile.filterLinks')}</option>
          </select>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 bg-[#252525] rounded-xl border border-[#333]">
              <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#555]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-[#888] font-medium">{t('mobile.noTransactions')}</p>
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-[#252525] p-4 border border-[#333] rounded-xl flex gap-3"
              >
                {/* Thumbnail / Icon */}
                <div className="flex-shrink-0">
                  {tx.metadata?.thumbnailUrl ? (
                    <div className="w-16 h-12 relative overflow-hidden rounded-lg bg-[#1a1a1a]">
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
                      tx.type === 'deduction' ? 'bg-red-900/30 text-red-400' : 'bg-emerald-900/30 text-emerald-400'
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
                        className="text-sm font-black text-[#E0E0E0] line-clamp-2 leading-tight block"
                      >
                        {tx.metadata.videoTitle}
                      </a>
                      <p className="text-[9px] text-[#888] font-bold uppercase tracking-wider">
                        {tx.metadata.videoAuthor && <span className="text-[#aaa]">{tx.metadata.videoAuthor}</span>}
                        {tx.metadata.videoAuthor && <span className="mx-2 text-[#555]">•</span>}
                        {new Date(tx.createdAt).toLocaleDateString(locale, {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-[#E0E0E0] uppercase tracking-wide">
                        {tx.description}
                      </h4>
                      <p className="text-[9px] text-[#888] font-medium uppercase tracking-widest">
                        {new Date(tx.createdAt).toLocaleDateString(locale, {
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
                    tx.type === 'deduction' ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {tx.type === 'deduction' ? '-' : '+'}{Math.abs(tx.amount).toLocaleString()}
                  </p>
                  <p className="text-[8px] font-bold text-[#888] uppercase">
                    {t('mobile.pointsLabel')}
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
