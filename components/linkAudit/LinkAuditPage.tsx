
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { scrapeLink, analyzeLinkDeep } from '../../services/linkAudit/linkService';
import { saveAnalysis } from '../../services/archiveService';
import { validateNewsUrl } from '../../services/validation';
import { VideoAnalysis, APIUsage } from '../../types';
import ReliabilityGauge from './ReliabilityGauge';
import MetricBlock from '../common/MetricBlock';
import LinkResultView from '../common/result-views/LinkResultView';
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
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
    const [error, setError] = useState<string | null>(null);
    // activeTab moved to LinkResultView

    const { currentUser, userProfile, updateLocalBalance, refreshProfile } = useAuth();
    const navigate = useNavigate();

    // Fixed price for link/article analysis
    const LINK_AUDIT_PRICE = FIXED_PRICES.linkArticle;

    useEffect(() => {
        let interval: any;
        if (loading) {
            setLoadingPhase(0);
            setElapsedSeconds(0);
            interval = setInterval(() => {
                setLoadingPhase(prev => (prev + 1) % LOADING_PHASES.length);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [loading]);

    useEffect(() => {
        let timer: any;
        if (loading) {
            timer = setInterval(() => {
                setElapsedSeconds(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(timer);
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
            const { analysis: result, usage } = await analyzeLinkDeep(url, scraped.content, scraped.title, (status) => {
                setStreamingStatus(status);
            });

            // 3. Update local balance from server response (server already deducted points)
            if (usage?.newBalance !== undefined) {
                updateLocalBalance(usage.newBalance);
            } else {
                // Fallback: refresh from Firestore
                await refreshProfile();
            }

            // Navigate to result page instead of inline rendering
            navigate('/analysis-result', {
                state: {
                    analysis: result,
                    type: 'link',
                    url: url
                }
            });

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

    const handleSave = async () => {
        if (!analysis || !currentUser) return;

        try {
            const id = await saveAnalysis(currentUser.uid, 'link', analysis.videoTitle || 'Link Analysis', analysis, url);
            // Update analysis with the new ID (persistence ID)
            setAnalysis({ ...analysis, id: id });
            // Show success notification (could be a toast, but for now simple alert or UI change)
            // For now, ID change will trigger UI update in ResultView
        } catch (err) {
            console.error('Failed to save', err);
            setError('Грешка при запазване на анализа.');
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
                        className="px-12 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all bg-amber-900 text-white hover:bg-black active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:active:scale-100"
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
                    <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center px-8">
                        <div className="text-center space-y-8 max-w-lg w-full">
                            <div className="w-full h-1 bg-slate-100 relative overflow-hidden"><div className="absolute inset-0 bg-slate-900 animate-[loading_2s_infinite]"></div></div>
                            <div className="space-y-4">
                                <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-[0.3em] serif italic animate-pulse">ЛИНК ОДИТ В ПРОЦЕС</h2>
                                <div className="font-mono text-3xl md:text-4xl font-black text-slate-800 tracking-[0.15em]">
                                    {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
                                </div>
                                <p className="text-[10px] md:text-[11px] font-black text-amber-900 uppercase tracking-widest leading-relaxed h-12">
                                    {LOADING_PHASES[loadingPhase]}
                                </p>
                                {streamingStatus && (
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                                        {streamingStatus}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </section>
    );
};

export default LinkAuditPage;
