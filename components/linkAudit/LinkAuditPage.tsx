
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { scrapeLink, analyzeLinkDeep } from '../../services/linkAudit/linkService';
import { saveAnalysis } from '../../services/archiveService';
import { validateNewsUrl } from '../../services/validation';
import { VideoAnalysis, APIUsage } from '../../types';
import ReliabilityGauge from './ReliabilityGauge';
import MetricBlock from '../common/MetricBlock';
import { FIXED_PRICES } from '../../config/pricingConfig';

const LOADING_PHASES = [
    "Установяване на криптирана връзка със сайта...",
    "Екстракция на текстови масиви и метаданни...",
    "Семантичен анализ на лингвистичните структури...",
    "Крос-рефериране с глобални бази данни...",
    "Деконструкция на логически заблуди...",
    "Идентифициране на манипулативни техники...",
    "Изчисляване на индекси за достоверност...",
    "Формиране на финален одит доклад..."
];

const LinkAuditPage: React.FC = () => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingPhase, setLoadingPhase] = useState(0);
    const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'summary' | 'claims' | 'manipulation' | 'report'>('summary');

    const { currentUser, userProfile, updateLocalBalance, refreshProfile } = useAuth();
    const navigate = useNavigate();

    // Fixed price for link/article analysis
    const LINK_AUDIT_PRICE = FIXED_PRICES.linkArticle;

    useEffect(() => {
        let interval: any;
        if (loading) {
            interval = setInterval(() => {
                setLoadingPhase(prev => (prev + 1) % LOADING_PHASES.length);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [loading]);

    const handleStartAnalysis = async () => {
        if (!url.trim()) return;

        // Validate URL
        const validation = validateNewsUrl(url);
        if (!validation.valid) {
            setError(validation.error || 'Невалиден URL адрес');
            return;
        }

        if (!currentUser) {
            navigate('/login');
            return;
        }

        // Check balance before starting (server also checks, but we show user-friendly message)
        if (userProfile && userProfile.pointsBalance < LINK_AUDIT_PRICE) {
            setError(`Недостатъчно точки! Нужни са ${LINK_AUDIT_PRICE} точки. Моля, купете точки от Pricing страницата.`);
            return;
        }

        setError(null);
        setLoading(true);
        setAnalysis(null);
        setStreamingStatus('Започване на извличане на съдържание...');

        try {
            // 1. Scrape content
            const scraped = await scrapeLink(url);

            // 2. Analyze (server-side billing - points deducted AFTER successful generation)
            const { analysis: result, usage } = await analyzeLinkDeep(url, scraped.content, (status) => {
                setStreamingStatus(status);
            });

            // 3. Update local balance from server response (server already deducted points)
            if (usage?.newBalance !== undefined) {
                updateLocalBalance(usage.newBalance);
            } else {
                // Fallback: refresh from Firestore
                await refreshProfile();
            }

            setAnalysis(result);

            // Save to archive
            try {
                await saveAnalysis(currentUser.uid, 'link', result.videoTitle || 'Link Analysis', result, url);
            } catch (saveErr) {
                console.error('[LinkAudit] Failed to save to archive:', saveErr);
            }
        } catch (e: any) {
            console.error('[LinkAudit] ❌ Error:', e);

            // Handle specific error codes
            if (e.code === 'INSUFFICIENT_POINTS') {
                setError('Недостатъчно точки за анализ. Моля, закупете точки от Pricing страницата.');
            } else if (e.statusCode === 401 || e.code === 'API_KEY_ERROR') {
                setError('Грешка при свързване със сървъра. Моля, опитайте по-късно.');
            } else if (e.code === 'RATE_LIMIT') {
                setError('Много заявки за кратко време. Моля, изчакайте 1-2 минути и опитайте отново.');
            } else {
                setError(e.message || 'Възникна грешка при анализа. Моля, опитайте отново.');
            }
        } finally {
            setLoading(false);
            setStreamingStatus(null);
        }
    };

    return (
        <section id="link-analysis" className="py-20 border-t border-slate-200 bg-[#f9f9f9] selection:bg-amber-900 selection:text-white">
            <div className="max-w-7xl mx-auto px-4">
                <div className="text-center space-y-4 mb-12">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <span className="h-[1px] w-8 bg-amber-900/30"></span>
                        <span className="text-[10px] font-black text-amber-900 uppercase tracking-[0.4em]">Независим Линк Одит</span>
                        <span className="h-[1px] w-8 bg-amber-900/30"></span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight italic serif">
                        Анализирай <span className="text-amber-900">всяка</span> статия
                    </h1>
                </div>

                {/* Input Section */}
                <div className="max-w-3xl mx-auto editorial-card p-2 mb-12 flex flex-col md:flex-row gap-2">
                    <input
                        type="url"
                        placeholder="https://news-site.bg/ime-na-statiata..."
                        className="flex-1 bg-transparent px-6 py-4 text-slate-900 font-bold focus:outline-none placeholder:text-slate-300"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleStartAnalysis()}
                        disabled={loading}
                    />
                    <button
                        onClick={handleStartAnalysis}
                        disabled={loading || !url.trim()}
                        className="bg-amber-900 text-white px-10 py-4 font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Анализира се...' : 'Одит'}
                    </button>
                </div>

                {error && (
                    <div className="max-w-3xl mx-auto mb-8 p-6 bg-red-50 border-l-4 border-red-900 text-red-900 animate-slideUp">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <span className="font-bold text-sm tracking-tight">{error}</span>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="max-w-4xl mx-auto text-center space-y-12 py-20 animate-fadeIn">
                        <div className="relative inline-block">
                            <div className="w-24 h-24 border-2 border-slate-100 border-t-amber-900 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-16 h-16 border-2 border-slate-100 border-b-amber-900 rounded-full animate-spin-slow"></div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <p className="text-2xl font-black text-slate-900 italic serif tracking-tight">
                                {LOADING_PHASES[loadingPhase]}
                            </p>
                            <p className="text-amber-900 font-bold uppercase tracking-[0.2em] text-[10px] h-4">
                                {streamingStatus}
                            </p>
                        </div>
                    </div>
                )}

                {analysis && (
                    <div className="animate-fadeIn">
                        {/* Results Header */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
                            {/* Summary Metrics */}
                            <div className="lg:col-span-8 space-y-6">
                                <div className="editorial-card p-10 flex flex-col md:flex-row items-center gap-10 bg-white">
                                    <div className="w-48 h-48 flex-shrink-0">
                                        <ReliabilityGauge score={analysis.summary.detailedStats.factualAccuracy} />
                                    </div>
                                    <div className="space-y-6 text-center md:text-left">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">{analysis.videoAuthor} • Генерална оценка</p>
                                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter serif italic leading-tight">
                                                {analysis.videoTitle}
                                            </h2>
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className={`px-3 py-1 text-[10px] font-black text-white uppercase tracking-widest
                                                    ${analysis.summary.finalClassification === 'ACCURATE' ? 'bg-emerald-700' :
                                                        analysis.summary.finalClassification === 'MOSTLY_ACCURATE' ? 'bg-emerald-600' :
                                                            analysis.summary.finalClassification === 'MIXED' ? 'bg-amber-600' :
                                                                analysis.summary.finalClassification === 'MISLEADING' ? 'bg-orange-700' : 'bg-red-800'}`}>
                                                    {analysis.summary.finalClassification === 'ACCURATE' ? 'Достоверно' :
                                                        analysis.summary.finalClassification === 'MOSTLY_ACCURATE' ? 'Предимно точно' :
                                                            analysis.summary.finalClassification === 'MIXED' ? 'Смесени данни' :
                                                                analysis.summary.finalClassification === 'MISLEADING' ? 'Подвеждащо' : 'Невярно'}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-slate-600 font-medium leading-relaxed italic text-sm border-l-2 border-slate-200 pl-4">
                                            "{analysis.summary.overallSummary.substring(0, 300)}..."
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <MetricBlock label="Факти" value={analysis.summary.detailedStats.factualAccuracy} color="emerald" />
                                    <MetricBlock label="Логика" value={analysis.summary.detailedStats.logicalSoundness} color="blue" />
                                    <MetricBlock label="Емоция" value={analysis.summary.detailedStats.emotionalBias} color="orange" />
                                    <MetricBlock label="Пропаганда" value={analysis.summary.detailedStats.propagandaScore} color="red" />
                                </div>
                            </div>

                            {/* Info Sidebar */}
                            <div className="lg:col-span-4 space-y-6">
                                <div className="editorial-card p-8 bg-slate-900 text-white space-y-6 h-full">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Детайли на обекта</h3>
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-bold text-amber-500 uppercase">Източник</p>
                                            <p className="font-bold truncate text-sm">{new URL(url).hostname}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-bold text-amber-500 uppercase">Тип анализ</p>
                                            <p className="font-bold text-sm">Дълбок текстови одит</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-bold text-amber-500 uppercase">Цена на одит</p>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xl font-black text-white">{LINK_AUDIT_PRICE}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">точки</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex border-b border-slate-200 mb-8 overflow-x-auto no-scrollbar scroll-smooth sticky top-[72px] md:top-[92px] z-40 bg-[#f9f9f9]/95 backdrop-blur-md py-2 transition-all duration-300">
                            {(['summary', 'claims', 'manipulation', 'report'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative flex-shrink-0
                                        ${activeTab === tab ? 'text-amber-900' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {tab === 'summary' ? 'Резюме' :
                                        tab === 'claims' ? 'ВЕРИФИКАЦИЯ' :
                                            tab === 'manipulation' ? 'МАНИПУЛАЦИИ' : 'ПЪЛЕН ДОКЛАД'}
                                    {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-900"></div>}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <main className="max-w-7xl mx-auto">
                            {activeTab === 'summary' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
                                    <div className="editorial-card p-10 space-y-6 bg-white">
                                        <h3 className="text-xl font-black text-slate-900 serif italic border-b-2 border-slate-100 pb-4">Кратко резюме</h3>
                                        <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{analysis.summary.overallSummary}</p>
                                    </div>
                                    <div className="editorial-card p-10 space-y-6 border-l-4 border-l-amber-900 bg-white">
                                        <h3 className="text-xl font-black text-slate-900 serif italic border-b-2 border-slate-100 pb-4">Препоръки</h3>
                                        <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{analysis.summary.recommendations}</p>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'claims' && (
                                <div className="space-y-6 animate-fadeIn">
                                    {analysis.claims.map((claim, idx) => (
                                        <div key={idx} className="editorial-card p-8 bg-white border-l-4 group hover:shadow-xl transition-all"
                                            style={{ borderLeftColor: claim.veracity === 'вярно' ? '#047857' : claim.veracity === 'невярно' ? '#991b1b' : '#b45309' }}>
                                            <div className="flex flex-col md:flex-row justify-between gap-6">
                                                <div className="space-y-4 flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-3 py-1 text-[9px] font-black text-white uppercase tracking-widest
                                                            ${claim.veracity === 'вярно' ? 'bg-emerald-700' : claim.veracity === 'невярно' ? 'bg-red-800' : 'bg-amber-700'}`}>
                                                            {claim.veracity}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Твърдение #{idx + 1}</span>
                                                    </div>
                                                    <p className="text-lg font-black text-slate-900 tracking-tight leading-snug italic serif">"{claim.quote}"</p>
                                                    <div className="p-4 bg-slate-50 rounded-sm border-l-2 border-slate-200">
                                                        <p className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Доказателства / Анализ</p>
                                                        <p className="text-sm text-slate-800 leading-relaxed font-medium">{claim.explanation}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'manipulation' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                                    {analysis.manipulations.map((tech, idx) => (
                                        <div key={idx} className="editorial-card p-8 bg-white border-t-4 border-t-amber-900 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight italic serif">{tech.technique}</h4>
                                                <div className="bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                                                    <span className="text-[9px] font-black text-amber-900 uppercase tracking-widest">Тежест: {Math.round(tech.severity * 100)}%</span>
                                                </div>
                                            </div>
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">{tech.logic.substring(0, 100)}...</p>
                                            <p className="text-sm text-slate-700 leading-relaxed font-medium">{tech.logic}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'report' && (
                                <div className="editorial-card p-12 bg-white max-w-4xl mx-auto shadow-2xl animate-fadeIn">
                                    <div className="text-center mb-12 space-y-4">
                                        <p className="text-[10px] font-black text-amber-900 uppercase tracking-[0.3em]">Официален разследващ доклад</p>
                                        <h2 className="text-4xl font-black text-slate-900 italic serif">Заключителен анализ</h2>
                                        <div className="w-24 h-1 bg-amber-900 mx-auto mt-4"></div>
                                    </div>
                                    <div className="prose prose-slate max-w-none prose-headings:serif prose-headings:italic prose-p:leading-relaxed prose-p:text-slate-700 prose-p:font-medium">
                                        <div className="whitespace-pre-wrap text-lg first-letter:text-5xl first-letter:font-black first-letter:mr-3 first-letter:float-left first-letter:text-amber-900 font-serif leading-relaxed">
                                            {analysis.summary.finalInvestigativeReport}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </main>
                    </div>
                )}
            </div>
        </section>
    );
};

export default LinkAuditPage;
