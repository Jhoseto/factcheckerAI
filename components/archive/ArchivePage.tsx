/**
 * Archive Page
 * Redesigned to match ExpensesPage style
 */

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
    const { user } = useAuth(); // Note: AuthContext exports 'user' or 'currentUser'? Checking context... usually currentUser based on previous files.
    // Re-checking AuthContext usage in ExpensesPage: const { currentUser } = useAuth();
    // Start correction: use currentUser
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

    // Metrics
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
            case 'video': return 'text-amber-900 bg-amber-50 border-amber-200';
            case 'link': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
            case 'social': return 'text-purple-800 bg-purple-50 border-purple-200';
            default: return 'text-slate-700 bg-slate-50 border-slate-200';
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center bg-[#f9f9f9]">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-amber-900 rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Зареждане на архив...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-slate-50 px-4 py-8 md:py-12 pt-24">
            <div className="max-w-6xl mx-auto space-y-10 animate-fadeIn">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-200 pb-8">
                    <div className="space-y-2 text-center md:text-left w-full">
                        <div className="flex items-center justify-center md:justify-start gap-3">
                            <span className="h-[1.5px] w-8 bg-amber-900/60"></span>
                            <span className="text-[10px] font-black text-amber-900 uppercase tracking-[0.3em]">
                                Библиотека
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight serif italic">
                            Архив на <span className="text-amber-900">Анализи</span>
                        </h1>
                        <p className="text-sm text-slate-500 max-w-xl mx-auto md:mx-0 pt-2">
                            Управлявайте вашето портфолио от дигитални разследвания. Всички доклади се съхраняват сигурно и са достъпни по всяко време.
                        </p>
                    </div>
                </div>

                {/* Storage Quotas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`editorial-card p-5 border-t-4 ${counts.video >= LIMITS.video ? 'border-t-red-500 bg-red-50/50' : 'border-t-amber-900 bg-white'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ВИДЕО СЛОТОВЕ</span>
                            <span className={`text-xs font-black ${counts.video >= LIMITS.video ? 'text-red-600' : 'text-amber-900'}`}>{counts.video} / {LIMITS.video}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${counts.video >= LIMITS.video ? 'bg-red-500' : 'bg-amber-900'}`} style={{ width: `${(counts.video / LIMITS.video) * 100}%` }}></div>
                        </div>
                    </div>

                    <div className={`editorial-card p-5 border-t-4 ${counts.link >= LIMITS.link ? 'border-t-red-500 bg-red-50/50' : 'border-t-emerald-600 bg-white'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ЛИНК СЛОТОВЕ</span>
                            <span className={`text-xs font-black ${counts.link >= LIMITS.link ? 'text-red-600' : 'text-emerald-700'}`}>{counts.link} / {LIMITS.link}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${counts.link >= LIMITS.link ? 'bg-red-500' : 'bg-emerald-600'}`} style={{ width: `${(counts.link / LIMITS.link) * 100}%` }}></div>
                        </div>
                    </div>

                    <div className={`editorial-card p-5 border-t-4 ${counts.social >= LIMITS.social ? 'border-t-red-500 bg-red-50/50' : 'border-t-purple-600 bg-white'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">СОЦИАЛНИ СЛОТОВЕ</span>
                            <span className={`text-xs font-black ${counts.social >= LIMITS.social ? 'text-red-600' : 'text-purple-800'}`}>{counts.social} / {LIMITS.social}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${counts.social >= LIMITS.social ? 'bg-red-500' : 'bg-purple-600'}`} style={{ width: `${(counts.social / LIMITS.social) * 100}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* Filters & Search - Matching ExpensesPage */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-sm border border-slate-100 shadow-sm sticky top-24 z-30">
                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                        {(['all', 'video', 'link', 'social'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap rounded-sm ${filter === f
                                    ? 'bg-amber-900 text-white'
                                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
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
                                placeholder="Търсене..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:border-amber-900 placeholder:text-slate-400 transition-colors uppercase"
                            />
                            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as any)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 focus:outline-none focus:border-amber-900 uppercase tracking-wide cursor-pointer"
                        >
                            <option value="date_desc">Най-нови</option>
                            <option value="date_asc">Най-стари</option>
                        </select>
                    </div>
                </div>

                {/* List */}
                <div className="space-y-4">
                    {filteredAnalyses.length === 0 ? (
                        <div className="text-center py-20 bg-white border border-slate-100 rounded-sm">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="text-3xl opacity-20">📭</span>
                            </div>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">Няма намерени анализи</h3>
                            <p className="text-sm text-slate-500">Променете филтрите или направете нов анализ.</p>
                            <button onClick={() => navigate('/')} className="mt-6 px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">
                                Нов Анализ
                            </button>
                        </div>
                    ) : (
                        filteredAnalyses.map((analysis) => (
                            <div
                                key={analysis.id}
                                onClick={() => navigate(`/report/${analysis.id}`)}
                                className="group bg-white p-5 md:p-6 border border-slate-200 shadow-sm hover:shadow-lg hover:border-amber-200 transition-all cursor-pointer relative editorial-card"
                            >
                                <div className="flex flex-col md:flex-row gap-6 items-start">
                                    {/* Icon/Type */}
                                    <div className={`w-12 h-12 md:w-16 md:h-16 flex-shrink-0 flex items-center justify-center rounded-sm border ${getTypeColor(analysis.type)}`}>
                                        <span className="text-2xl">
                                            {analysis.type === 'video' ? '🎬' : analysis.type === 'link' ? '🔗' : '📱'}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex flex-wrap gap-2 items-center">
                                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border ${getTypeColor(analysis.type)}`}>
                                                {getTypeLabel(analysis.type)}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                {analysis.createdAt && (analysis.createdAt as any).toDate
                                                    ? (analysis.createdAt as any).toDate().toLocaleDateString('bg-BG')
                                                    : new Date(analysis.createdAt as any).toLocaleDateString('bg-BG')}
                                            </span>
                                        </div>

                                        <h3 className="text-lg md:text-xl font-black text-slate-900 group-hover:text-amber-900 transition-colors leading-tight serif">
                                            {analysis.title || 'Анализ без заглавие'}
                                        </h3>

                                        {analysis.url && (
                                            <p className="text-xs text-slate-500 truncate font-mono bg-slate-50 p-1 rounded inline-block max-w-full">
                                                {analysis.url}
                                            </p>
                                        )}

                                        {/* Metrics Tags */}
                                        {analysis.analysis?.summary && (
                                            <div className="flex flex-wrap gap-4 pt-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                                        Доверие: <span className="text-slate-900">{Math.round((analysis.analysis.summary.credibilityIndex || 0) * 100)}%</span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                                        Манипулация: <span className="text-slate-900">{Math.round((analysis.analysis.summary.manipulationIndex || 0) * 100)}%</span>
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-row md:flex-col gap-3 items-center md:items-end justify-between w-full md:w-auto mt-4 md:mt-0 pl-0 md:pl-6 md:border-l border-slate-100">
                                        <div className="text-right">
                                            <span className="block text-xl font-black text-slate-900">-{analysis.analysis.pointsCost || 0}</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">ТОЧКИ</span>
                                        </div>

                                        <button
                                            onClick={(e) => handleDelete(analysis.id!, e)}
                                            className="px-3 py-2 text-[9px] font-black text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors uppercase tracking-widest flex items-center gap-1"
                                            title="Изтрий анализа"
                                        >
                                            <span className="text-lg leading-none">×</span> ИЗТРИЙ
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <footer className="text-center pt-12 pb-8 border-t border-slate-200">
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">FACTCHECKER AI • SECURE VAULT</p>
                </footer>
            </div>
        </div>
    );
};

export default ArchivePage;
