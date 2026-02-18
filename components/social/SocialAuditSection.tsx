import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { analyzeSocialPost, scrapeSocialPost, SocialScrapeResponse } from '../../services/socialService';
import { saveAnalysis } from '../../services/archiveService';
import { VideoAnalysis, APIUsage } from '../../types';
import ScannerAnimation from '../common/ScannerAnimation';
import MetricBlock from '../common/MetricBlock';
import { useNavigate } from 'react-router-dom';

const SocialAuditSection: React.FC = () => {
    const { currentUser, pointsBalance, updateLocalBalance, refreshProfile } = useAuth();
    const navigate = useNavigate();

    const [url, setUrl] = useState('');
    const [platform, setPlatform] = useState<'facebook' | 'twitter' | 'tiktok' | null>(null);
    const [scrapedData, setScrapedData] = useState<SocialScrapeResponse | null>(null);
    const [analysisType, setAnalysisType] = useState<'post' | 'comments' | 'full'>('post');
    const [isLoading, setIsLoading] = useState(false);
    const [isScraping, setIsScraping] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [result, setResult] = useState<VideoAnalysis | null>(null);
    const [usage, setUsage] = useState<APIUsage | null>(null);

    // Detect platform from URL
    useEffect(() => {
        if (!url) {
            setPlatform(null);
            return;
        }

        const urlLower = url.toLowerCase();
        if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) {
            setPlatform('facebook');
        } else if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
            setPlatform('twitter');
        } else if (urlLower.includes('tiktok.com')) {
            setPlatform('tiktok');
        } else {
            setPlatform(null);
        }
    }, [url]);

    const validateUrl = (url: string): boolean => {
        if (!url) return false;
        const urlLower = url.toLowerCase();
        return urlLower.includes('facebook.com') ||
            urlLower.includes('fb.watch') ||
            urlLower.includes('twitter.com') ||
            urlLower.includes('x.com') ||
            urlLower.includes('tiktok.com');
    };

    const handleScrape = async () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        if (!validateUrl(url)) {
            setError('Моля, въведете валиден URL от Facebook, Twitter/X или TikTok');
            return;
        }

        setIsScraping(true);
        setError('');
        setScrapedData(null);

        try {
            const data = await scrapeSocialPost(url);
            setScrapedData(data);
            setStatus('Публикацията е извлечена успешно!');
        } catch (err: any) {
            setError(err.message || 'Грешка при извличане на публикацията');
        } finally {
            setIsScraping(false);
        }
    };

    const handleAnalyze = async () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        if (!scrapedData) {
            setError('Първо извлечете публикацията');
            return;
        }

        setIsLoading(true);
        setError('');
        setStatus('Анализирам...');

        try {
            const { analysis, usage: apiUsage } = await analyzeSocialPost(
                url,
                scrapedData,
                analysisType,
                (progress) => setStatus(progress)
            );

            setResult(analysis);
            setUsage(apiUsage);

            // Save to archive
            try {
                await saveAnalysis(currentUser.uid, 'social', result.videoTitle || 'Анализ на социална мрежа', result, url);
            } catch (saveErr) {
                console.error('[SocialAudit] Failed to save to archive:', saveErr);
            }

            // Update local balance from server response
            if (apiUsage.newBalance !== undefined) {
                updateLocalBalance(apiUsage.newBalance);
            } else {
                refreshProfile();
            }

            setStatus('Анализът завърши успешно!');
        } catch (err: any) {
            console.error('[SocialAudit] Error:', err);
            if (err.code === 'INSUFFICIENT_POINTS') {
                setError('Недостатъчно точки за анализ. Моля, закупете точки от Pricing страницата.');
            } else if (err.message?.includes('недостатъчно')) {
                setError(err.message);
            } else {
                setError(err.message || 'Грешка при анализ');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setUrl('');
        setScrapedData(null);
        setResult(null);
        setUsage(null);
        setError('');
        setStatus('');
    };

    const platformIcons: Record<string, string> = {
        facebook: '📘',
        twitter: '🐦',
        tiktok: '🎵'
    };

    const platformNames: Record<string, string> = {
        facebook: 'Facebook',
        twitter: 'Twitter/X',
        tiktok: 'TikTok'
    };

    const pointsCost = analysisType === 'full' ? 20 : analysisType === 'comments' ? 15 : 8;

    return (
        <section id="social-analysis" className="py-20 border-t border-slate-200 bg-white selection:bg-amber-900 selection:text-white">
            <div className="max-w-7xl mx-auto px-4">
                <div className="text-center space-y-4 mb-12">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <span className="h-[1px] w-8 bg-amber-900/30"></span>
                        <span className="text-[10px] font-black text-amber-900 uppercase tracking-[0.4em]">ЕКСПЕРТЕН ОДИТ * СОЦИАЛНИ МРЕЖИ</span>
                        <span className="h-[1px] w-8 bg-amber-900/30"></span>
                    </div>
                    <h3 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight italic serif">
                        Анализирай <span className="text-amber-900">социални</span> мрежи
                    </h3>
                </div>

                <div className="max-w-4xl mx-auto">
                    {/* Error Display */}
                    {error && (
                        <div className="max-w-3xl mx-auto mb-8 p-6 bg-red-50 border-l-4 border-red-900 text-red-900 animate-slideUp">
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-sm tracking-tight">{error}</span>
                            </div>
                        </div>
                    )}

                    {/* Status Display */}
                    {status && !error && (
                        <div className="max-w-3xl mx-auto mb-8 p-4 bg-amber-50/50 border border-amber-100 text-amber-900 text-center rounded-sm">
                            <span className="text-xs font-black uppercase tracking-widest">{status}</span>
                        </div>
                    )}

                    {!result ? (
                        /* Input Form */
                        <div className="editorial-card p-8 bg-slate-50 border border-slate-200 mb-6">
                            <div className="mb-8">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    URL на публикацията
                                </label>
                                <div className="flex flex-col md:flex-row gap-2">
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://facebook.com/... или https://x.com/..."
                                        className="flex-1 bg-white px-4 py-3 text-slate-900 font-bold border border-slate-300 focus:border-amber-900 focus:outline-none placeholder:text-slate-300"
                                    />
                                    <button
                                        onClick={handleScrape}
                                        disabled={isScraping || !platform}
                                        className="px-12 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all bg-amber-900 text-white hover:bg-black active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:active:scale-100"
                                    >
                                        {isScraping ? '...' : 'ОДИТ'}
                                    </button>
                                </div>
                                {platform && (
                                    <p className="text-[10px] font-bold text-amber-700 mt-2 uppercase tracking-wider flex items-center gap-2">
                                        {platformIcons[platform]} Разпозната платформа: {platformNames[platform]}
                                    </p>
                                )}
                            </div>

                            {scrapedData && (
                                <div className="animate-fadeIn space-y-8">
                                    <div className="bg-white p-6 border-l-2 border-amber-900 shadow-sm">
                                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Извлечени данни</h4>
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-900 font-bold"><span className="text-slate-500 font-normal">Автор:</span> {scrapedData.author}</p>
                                            <p className="text-sm text-slate-900 font-bold"><span className="text-slate-500 font-normal">Платформа:</span> {platformNames[scrapedData.platform]}</p>
                                            <p className="text-sm text-slate-700 italic border-t border-slate-100 pt-2 mt-2 leading-relaxed">
                                                "{scrapedData.postContent.substring(0, 300)}..."
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">
                                            Тип анализ
                                        </label>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {[
                                                { id: 'post', label: 'Пост', cost: 8 },
                                                { id: 'comments', label: 'Коментари', cost: 15 },
                                                { id: 'full', label: 'Пълен', cost: 20 }
                                            ].map((type) => (
                                                <button
                                                    key={type.id}
                                                    onClick={() => setAnalysisType(type.id as any)}
                                                    className={`p-4 border-2 transition-all text-center space-y-1 ${analysisType === type.id
                                                        ? 'border-amber-900 bg-amber-50'
                                                        : 'border-slate-200 bg-white hover:border-amber-200'
                                                        }`}
                                                >
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-900">{type.label}</div>
                                                    <div className="text-xl font-black text-amber-900">{type.cost} <span className="text-[9px] text-slate-400 uppercase font-bold">т.</span></div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleAnalyze}
                                        disabled={isLoading}
                                        className="w-full bg-amber-900 text-white py-4 font-black uppercase tracking-[0.2em] text-[10px] hover:bg-black transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center justify-center gap-3">
                                                <ScannerAnimation size={20} className="scale-50" />
                                                АНАЛИЗИРАМ...
                                            </span>
                                        ) : (
                                            `АНАЛИЗИРАЙ (${pointsCost} ТОЧКИ)`
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Results Display */
                        <div className="bg-white editorial-card p-8 animate-fadeIn space-y-8">
                            <div className="flex justify-between items-center border-b-2 border-slate-100 pb-6">
                                <h2 className="text-2xl font-black text-slate-900 serif italic">Резултати от анализа</h2>
                                <button
                                    onClick={resetForm}
                                    className="text-[9px] font-black text-amber-900 uppercase tracking-widest hover:text-amber-700 transition-colors"
                                >
                                    ↺ НОВ АНАЛИЗ
                                </button>
                            </div>

                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <MetricBlock
                                    label="Доверие"
                                    value={result.summary.credibilityIndex}
                                    color={result.summary.credibilityIndex > 0.6 ? 'emerald' : result.summary.credibilityIndex > 0.4 ? 'orange' : 'red'}
                                />
                                <MetricBlock
                                    label="Манипулация"
                                    value={result.summary.manipulationIndex}
                                    color={result.summary.manipulationIndex < 0.3 ? 'emerald' : result.summary.manipulationIndex < 0.6 ? 'orange' : 'red'}
                                />
                                <div className="editorial-card p-4 border-t-2 border-t-slate-800">
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Твърдения</p>
                                    <span className="text-2xl font-black text-slate-900">{result.claims.length}</span>
                                </div>
                                <div className="editorial-card p-4 border-t-2 border-t-slate-800">
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Оценка</p>
                                    <span className={`text-sm font-black uppercase tracking-tight ${result.summary.finalClassification === 'TRUE' ? 'text-emerald-700' :
                                        result.summary.finalClassification === 'FALSE' ? 'text-red-700' : 'text-amber-700'
                                        }`}>
                                        {result.summary.finalClassification === 'TRUE' ? 'ВЯРНО' :
                                            result.summary.finalClassification === 'FALSE' ? 'НЕВЯРНО' : 'СМЕСЕНО'}
                                    </span>
                                </div>
                            </div>

                            {/* Claims */}
                            {result.claims.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight border-b border-slate-200 pb-2">Идентифицирани Твърдения</h3>
                                    <div className="space-y-4">
                                        {result.claims.map((claim, idx) => (
                                            <div key={idx} className="bg-slate-50 p-6 border-l-4" style={{ borderColor: claim.veracity.includes('вярно') && !claim.veracity.includes('не') ? '#059669' : '#dc2626' }}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-white border ${claim.veracity.includes('вярно') && !claim.veracity.includes('не') ? 'text-emerald-700 border-emerald-200' : 'text-red-700 border-red-200'
                                                        }`}>
                                                        {claim.veracity}
                                                    </span>
                                                </div>
                                                <p className="text-lg font-bold text-slate-900 serif italic mb-3">"{claim.quote}"</p>
                                                <p className="text-sm text-slate-600 leading-relaxed font-medium">{claim.explanation}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Overall Summary */}
                            <div className="bg-amber-50/50 p-8 border border-amber-100">
                                <h3 className="text-[9px] font-black text-amber-900 uppercase tracking-widest mb-4">Обобщение</h3>
                                <p className="text-slate-800 leading-relaxed serif font-medium">
                                    {result.summary.overallSummary || result.summary.finalInvestigativeReport}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default SocialAuditSection;
