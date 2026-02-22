import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getUserAnalyses, SavedAnalysis, deleteAnalysis } from '../../services/archiveService';

const LIMITS = {
    video: 10,
    link: 15,
    social: 15
};

const ArchivePage: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'video' | 'link' | 'social'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc'>('date_desc');

    useEffect(() => {
        if (!currentUser) return;
        loadAnalyses();
    }, [currentUser]);

    const loadAnalyses = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const data = await getUserAnalyses(currentUser.uid, undefined, 100);
            setAnalyses(data);
        } catch (error) {
            console.error('[ArchivePage] Error loading analyses:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Сигурни ли сте, че искате да изтриете този анализ?')) {
            try {
                await deleteAnalysis(id);
                setAnalyses(prev => prev.filter(a => a.id !== id));
            } catch (error) {
                console.error('Error deleting analysis', error);
                alert('Грешка при изтриване.');
            }
        }
    };

    const counts = {
        video: analyses.filter(a => a.type === 'video').length,
        link: analyses.filter(a => a.type === 'link').length,
        social: analyses.filter(a => a.type === 'social').length
    };

    const filteredAnalyses = analyses
        .filter(a => {
            if (filter !== 'all' && a.type !== filter) return false;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const title = a.title?.toLowerCase() || '';
                const url = a.url?.toLowerCase() || '';
                return title.includes(term) || url.includes(term);
            }
            return true;
        })
        .sort((a, b) => {
            const dateA = a.createdAt && (a.createdAt as any).toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt as any);
            const dateB = b.createdAt && (b.createdAt as any).toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt as any);
            return sortOrder === 'date_desc' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
        });

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'video': return 'Видео Анализ';
            case 'link': return 'Линк Одит';
            case 'social': return 'Социален Одит';
            default: return 'Анализ';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'video': return 'text-[#968B74] border-[#968B74]/40';
            case 'link': return 'text-emerald-400 border-emerald-500/40';
            case 'social': return 'text-purple-400 border-purple-500/40';
            default: return 'text-[#a3a3a3] border-[#404040]';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#222]">
                <div className="w-12 h-12 border-[1px] border-[#333] border-t-[#C4B091] rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden pt-40 pb-24">
             {/* Background */}
             <div className="premium-bg-wrapper">
                <div className="premium-wave-1"></div>
                <div className="premium-wave-2"></div>
                <div className="premium-wave-3"></div>
                <div className="premium-texture"></div>
            </div>

            <div className="max-w-6xl mx-auto px-6 relative z-10 animate-fadeUp">

                <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-[#968B74]/20 pb-8 mb-12">
                    <div className="space-y-2 text-center md:text-left w-full">
                        <div className="flex items-center justify-center md:justify-start gap-3">
                            <span className="h-[1px] w-8 bg-[#968B74]/60"></span>
                            <span className="text-[10px] font-bold text-[#C4B091] uppercase tracking-[0.3em]">
                                Библиотека
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-serif text-[#E0E0E0] tracking-tight">
                            АРХИВ НА <span className="italic text-bronze-gradient">АНАЛИЗИ</span>
                        </h1>
                        <p className="text-xs text-[#888] max-w-xl mx-auto md:mx-0 pt-2 uppercase tracking-wide">
                            Управлявайте вашето портфолио от дигитални разследвания.
                        </p>
                    </div>
                </div>

                {/* Storage Quotas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className={`editorial-card p-6 bg-[#252525]`}>
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[9px] font-bold text-[#888] uppercase tracking-widest">Видео Слотове</span>
                            <span className={`text-[10px] font-bold ${counts.video >= LIMITS.video ? 'text-red-500' : 'text-[#C4B091]'}`}>{counts.video} / {LIMITS.video}</span>
                        </div>
                        <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div className={`h-full ${counts.video >= LIMITS.video ? 'bg-red-500' : 'bg-[#968B74]'}`} style={{ width: `${(counts.video / LIMITS.video) * 100}%` }}></div>
                        </div>
                    </div>

                    <div className={`editorial-card p-6 bg-[#252525]`}>
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[9px] font-bold text-[#888] uppercase tracking-widest">Линк Слотове</span>
                            <span className={`text-[10px] font-bold ${counts.link >= LIMITS.link ? 'text-red-500' : 'text-emerald-500'}`}>{counts.link} / {LIMITS.link}</span>
                        </div>
                        <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div className={`h-full ${counts.link >= LIMITS.link ? 'bg-red-500' : 'bg-emerald-600'}`} style={{ width: `${(counts.link / LIMITS.link) * 100}%` }}></div>
                        </div>
                    </div>

                    <div className={`editorial-card p-6 bg-[#252525]`}>
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[9px] font-bold text-[#888] uppercase tracking-widest">Социални Слотове</span>
                            <span className={`text-[10px] font-bold ${counts.social >= LIMITS.social ? 'text-red-500' : 'text-purple-500'}`}>{counts.social} / {LIMITS.social}</span>
                        </div>
                        <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div className={`h-full ${counts.social >= LIMITS.social ? 'bg-red-500' : 'bg-purple-600'}`} style={{ width: `${(counts.social / LIMITS.social) * 100}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-6 justify-between items-center bg-[#252525] p-6 rounded-xl border border-[#333] shadow-lg sticky top-24 z-30">
                    <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                        {(['all', 'video', 'link', 'social'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-5 py-2 text-[9px] font-black uppercase tracking-[0.2em] transition-colors whitespace-nowrap rounded-sm ${filter === f
                                    ? 'bg-[#968B74] text-[#1a1a1a]'
                                    : 'bg-[#1a1a1a] text-[#666] border border-[#333] hover:border-[#968B74] hover:text-[#968B74]'
                                    }`}
                            >
                                {f === 'all' ? 'Всички' : getTypeLabel(f).split(' ')[0]}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <input
                                type="text"
                                placeholder="ТЪРСЕНЕ..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="input-luxury w-full pl-9 pr-4 py-2 rounded-sm text-[10px] uppercase tracking-widest placeholder:text-[#444]"
                            />
                            <svg className="w-3 h-3 text-[#444] absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as any)}
                            className="input-luxury px-4 py-2 rounded-sm text-[10px] uppercase tracking-widest cursor-pointer"
                        >
                            <option value="date_desc">Най-нови</option>
                            <option value="date_asc">Най-стари</option>
                        </select>
                    </div>
                </div>

                {/* List */}
                <div className="space-y-4 mt-8">
                    {filteredAnalyses.length === 0 ? (
                        <div className="text-center py-24 bg-[#252525] border border-[#333] rounded-xl opacity-50">
                            <h3 className="text-xs font-bold text-[#888] uppercase tracking-widest mb-2">Няма намерени досиета</h3>
                            <button onClick={() => navigate('/')} className="mt-4 text-[#C4B091] text-[9px] font-bold uppercase tracking-widest hover:underline">
                                Стартирай Нов Анализ
                            </button>
                        </div>
                    ) : (
                        filteredAnalyses.map((analysis) => (
                            <div
                                key={analysis.id}
                                onClick={() => navigate(`/report/${analysis.id}`)}
                                className="group editorial-card p-6 hover:border-[#968B74]/50 transition-all cursor-pointer bg-[#252525]"
                            >
                                <div className="flex flex-col md:flex-row gap-8 items-start">
                                    {/* Type Icon */}
                                    <div className={`w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-full border ${getTypeColor(analysis.type)} bg-[#1a1a1a]`}>
                                        <span className="text-xl">
                                            {analysis.type === 'video' ? '🎬' : analysis.type === 'link' ? '🔗' : '📱'}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-3">
                                        <div className="flex flex-wrap gap-3 items-center">
                                            <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-sm border ${getTypeColor(analysis.type)}`}>
                                                {getTypeLabel(analysis.type)}
                                            </span>
                                            <span className="text-[9px] font-bold text-[#666] uppercase tracking-widest">
                                                {analysis.createdAt && (analysis.createdAt as any).toDate
                                                    ? (analysis.createdAt as any).toDate().toLocaleDateString('bg-BG')
                                                    : new Date(analysis.createdAt as any).toLocaleDateString('bg-BG')}
                                            </span>
                                        </div>

                                        <h3 className="text-xl font-serif text-[#f0f0f0] group-hover:text-[#C4B091] transition-colors leading-tight">
                                            {analysis.title || 'Неидентифициран Анализ'}
                                        </h3>

                                        {analysis.url && (
                                            <p className="text-[10px] text-[#555] truncate font-mono uppercase tracking-wider">
                                                SOURCE: {analysis.url}
                                            </p>
                                        )}

                                        {/* Metrics */}
                                        {analysis.analysis?.summary && (
                                            <div className="flex flex-wrap gap-6 pt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1 h-1 rounded-full bg-[#888]"></span>
                                                    <span className="text-[9px] font-bold text-[#888] uppercase tracking-wide">
                                                        Доверие: <span className="text-[#C4B091]">{Math.round((analysis.analysis.summary.credibilityIndex || 0) * 100)}%</span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1 h-1 rounded-full bg-[#888]"></span>
                                                    <span className="text-[9px] font-bold text-[#888] uppercase tracking-wide">
                                                        Манипулация: <span className="text-[#C4B091]">{Math.round((analysis.analysis.summary.manipulationIndex || 0) * 100)}%</span>
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-row md:flex-col gap-4 items-center md:items-end justify-between w-full md:w-auto mt-4 md:mt-0 pl-0 md:pl-8 md:border-l border-[#333]">
                                        <div className="text-right hidden md:block">
                                            <span className="block text-xl font-serif text-[#968B74]">-{analysis.analysis.pointsCost || 0}</span>
                                            <span className="text-[8px] font-bold text-[#444] uppercase tracking-[0.3em]">ТОЧКИ</span>
                                        </div>

                                        <button
                                            onClick={(e) => handleDelete(analysis.id!, e)}
                                            className="px-4 py-2 text-[9px] font-black text-[#500] hover:text-red-500 hover:bg-[#1a1a1a] rounded-sm transition-colors uppercase tracking-[0.2em] flex items-center gap-2"
                                        >
                                            ИЗТРИЙ
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <footer className="text-center pt-16 pb-8 border-t border-[#222] mt-12 opacity-30">
                    <p className="text-[8px] font-bold text-[#666] uppercase tracking-[0.4em]">FACTCHECKER AI • SECURE VAULT</p>
                </footer>
            </div>
        </div>
    );
};

export default ArchivePage;
