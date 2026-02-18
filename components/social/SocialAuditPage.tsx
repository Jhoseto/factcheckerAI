/**
 * Social Media Audit Page
 * Analyzes Facebook, Twitter/X, TikTok posts
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { analyzeSocialPost, scrapeSocialPost, SocialScrapeResponse } from '../../services/socialService';
import { saveAnalysis } from '../../services/archiveService';

import ScannerAnimation from '../common/ScannerAnimation';
import MetricBlock from '../common/MetricBlock';
import { VideoAnalysis, APIUsage } from '../../types';

const SocialAuditPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, pointsBalance, updateLocalBalance } = useAuth();

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
        if (!user) {
            setError('Ð¢Ñ€ÑÐ±Ð²Ð° Ð´Ð° ÑÑ‚Ðµ Ð»Ð¾Ð³Ð½Ð°Ñ‚Ð¸');
            return;
        }

        if (!validateUrl(url)) {
            setError('ÐœÐ¾Ð»Ñ, Ð²ÑŠÐ²ÐµÐ´ÐµÑ‚Ðµ Ð²Ð°Ð»Ð¸Ð´ÐµÐ½ URL Ð¾Ñ‚ Facebook, Twitter/X Ð¸Ð»Ð¸ TikTok');
            return;
        }

        setIsScraping(true);
        setError('');
        setScrapedData(null);

        try {
            const data = await scrapeSocialPost(url);
            setScrapedData(data);
            setStatus('ÐŸÑƒÐ±Ð»Ð¸ÐºÐ°Ñ†Ð¸ÑÑ‚Ð° Ðµ Ð¸Ð·Ð²Ð»ÐµÑ‡ÐµÐ½Ð° ÑƒÑÐ¿ÐµÑˆÐ½Ð¾!');
        } catch (err: any) {
            setError(err.message || 'Ð“Ñ€ÐµÑˆÐºÐ° Ð¿Ñ€Ð¸ Ð¸Ð·Ð²Ð»Ð¸Ñ‡Ð°Ð½Ðµ Ð½Ð° Ð¿ÑƒÐ±Ð»Ð¸ÐºÐ°Ñ†Ð¸ÑÑ‚Ð°');
        } finally {
            setIsScraping(false);
        }
    };

    const handleAnalyze = async () => {
        if (!user) {
            setError('Ð¢Ñ€ÑÐ±Ð²Ð° Ð´Ð° ÑÑ‚Ðµ Ð»Ð¾Ð³Ð½Ð°Ñ‚Ð¸');
            return;
        }

        if (!scrapedData) {
            setError('ÐŸÑŠÑ€Ð²Ð¾ Ð¸Ð·Ð²Ð»ÐµÑ‡ÐµÑ‚Ðµ Ð¿ÑƒÐ±Ð»Ð¸ÐºÐ°Ñ†Ð¸ÑÑ‚Ð°');
            return;
        }

        setIsLoading(true);
        setError('');
        setStatus('ÐÐ½Ð°Ð»Ð¸Ð·Ð¸Ñ€Ð°Ð¼...');

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
                await saveAnalysis(user.uid, 'social', analysis.videoTitle || 'Social Media Analysis', analysis, url);
            } catch (saveErr) {
                console.error('[SocialAudit] Failed to save to archive:', saveErr);
            }

            // Update local balance from server response
            if (apiUsage.newBalance !== undefined) {
                updateLocalBalance(apiUsage.newBalance);
            }

            setStatus('ÐÐ½Ð°Ð»Ð¸Ð·ÑŠÑ‚ Ð·Ð°Ð²ÑŠÑ€ÑˆÐ¸ ÑƒÑÐ¿ÐµÑˆÐ½Ð¾!');
        } catch (err: any) {
            console.error('[SocialAudit] Error:', err);
            if (err.message?.includes('Ð½ÐµÐ´Ð¾ÑÑ‚Ð°Ñ‚ÑŠÑ‡Ð½Ð¾')) {
                setError(err.message);
            } else {
                setError(err.message || 'Ð“Ñ€ÐµÑˆÐºÐ° Ð¿Ñ€Ð¸ Ð°Ð½Ð°Ð»Ð¸Ð·');
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
        facebook: 'ðŸ“˜',
        twitter: 'ðŸ¦',
        tiktok: 'ðŸŽµ'
    };

    const platformNames: Record<string, string> = {
        facebook: 'Facebook',
        twitter: 'Twitter/X',
        tiktok: 'TikTok'
    };

    const pointsCost = analysisType === 'full' ? 20 : analysisType === 'comments' ? 15 : 8;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                        ðŸ” ÐÑƒÐ´Ð¸Ñ‚ Ð½Ð° Ð¡Ð¾Ñ†Ð¸Ð°Ð»Ð½Ð¸ ÐœÐµÐ´Ð¸Ð¸
                    </h1>
                    <p className="text-gray-300">
                        ÐÐ½Ð°Ð»Ð¸Ð·Ð¸Ñ€Ð°Ð¹Ñ‚Ðµ Ñ„Ð°ÐºÑ‚Ð¸ Ð¸ Ð¼Ð°Ð½Ð¸Ð¿ÑƒÐ»Ð°Ñ†Ð¸Ð¸ Ð²ÑŠÐ² Facebook, Twitter/X Ð¸ TikTok
                    </p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Status Display */}
                {status && !error && (
                    <div className="bg-blue-500/20 border border-blue-500 text-blue-200 px-4 py-3 rounded-lg mb-6">
                        {status}
                    </div>
                )}

                {!result ? (
                    /* Input Form */
                    <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 mb-6">
                        <div className="mb-6">
                            <label className="block text-white mb-2 font-medium">
                                URL Ð½Ð° Ð¿ÑƒÐ±Ð»Ð¸ÐºÐ°Ñ†Ð¸ÑÑ‚Ð°
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://facebook.com/... Ð¸Ð»Ð¸ https://x.com/... Ð¸Ð»Ð¸ https://tiktok.com/..."
                                    className="flex-1 bg-slate-700 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                                />
                                <button
                                    onClick={handleScrape}
                                    disabled={isScraping || !platform}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                >
                                    {isScraping ? '...' : 'Ð˜Ð·Ð²Ð»ÐµÑ‡Ð¸'}
                                </button>
                            </div>
                            {platform && (
                                <p className="text-sm text-green-400 mt-2">
                                    {platformIcons[platform]} Ð Ð°Ð·Ð¿Ð¾Ð·Ð½Ð°Ñ‚Ð° Ð¿Ð»Ð°Ñ‚Ñ„Ð¾Ñ€Ð¼Ð°: {platformNames[platform]}
                                </p>
                            )}
                        </div>

                        {scrapedData && (
                            <>
                                <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
                                    <h3 className="text-white font-medium mb-2">Ð˜Ð·Ð²Ð»ÐµÑ‡ÐµÐ½Ð¸ Ð´Ð°Ð½Ð½Ð¸:</h3>
                                    <p className="text-gray-300 text-sm mb-2">
                                        <strong>ÐÐ²Ñ‚Ð¾Ñ€:</strong> {scrapedData.author}
                                    </p>
                                    <p className="text-gray-300 text-sm mb-2">
                                        <strong>ÐŸÐ»Ð°Ñ‚Ñ„Ð¾Ñ€Ð¼Ð°:</strong> {platformIcons[scrapedData.platform]} {platformNames[scrapedData.platform]}
                                    </p>
                                    <p className="text-gray-300 text-sm line-clamp-4">
                                        <strong>Ð¡ÑŠÐ´ÑŠÑ€Ð¶Ð°Ð½Ð¸Ðµ:</strong> {scrapedData.postContent.substring(0, 300)}...
                                    </p>
                                </div>

                                <div className="mb-6">
                                    <label className="block text-white mb-2 font-medium">
                                        Ð¢Ð¸Ð¿ Ð°Ð½Ð°Ð»Ð¸Ð·
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <button
                                            onClick={() => setAnalysisType('post')}
                                            className={`p-3 rounded-lg border ${analysisType === 'post'
                                                    ? 'border-purple-500 bg-purple-500/20 text-white'
                                                    : 'border-slate-600 text-gray-300 hover:border-slate-500'
                                                }`}
                                        >
                                            <div className="font-medium">ÐŸÐ¾ÑÑ‚</div>
                                            <div className="text-sm">{pointsCost} Ñ‚.</div>
                                        </button>
                                        <button
                                            onClick={() => setAnalysisType('comments')}
                                            className={`p-3 rounded-lg border ${analysisType === 'comments'
                                                    ? 'border-purple-500 bg-purple-500/20 text-white'
                                                    : 'border-slate-600 text-gray-300 hover:border-slate-500'
                                                }`}
                                        >
                                            <div className="font-medium">ÐšÐ¾Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸</div>
                                            <div className="text-sm">15 Ñ‚.</div>
                                        </button>
                                        <button
                                            onClick={() => setAnalysisType('full')}
                                            className={`p-3 rounded-lg border ${analysisType === 'full'
                                                    ? 'border-purple-500 bg-purple-500/20 text-white'
                                                    : 'border-slate-600 text-gray-300 hover:border-slate-500'
                                                }`}
                                        >
                                            <div className="font-medium">ÐŸÑŠÐ»ÐµÐ½</div>
                                            <div className="text-sm">20 Ñ‚.</div>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleAnalyze}
                                    disabled={isLoading}
                                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-4 rounded-lg font-bold text-lg disabled:opacity-50 transition-all"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <ScannerAnimation size={24} />
                                            ÐÐ½Ð°Ð»Ð¸Ð·Ð¸Ñ€Ð°Ð¼...
                                        </span>
                                    ) : (
                                        `ÐÐ½Ð°Ð»Ð¸Ð·Ð¸Ñ€Ð°Ð¹ Ð·Ð° ${analysisType === 'full' ? 20 : analysisType === 'comments' ? 15 : 8} Ñ‚Ð¾Ñ‡ÐºÐ¸`
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    /* Results Display */
                    <div className="space-y-6">
                        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white">Ð ÐµÐ·ÑƒÐ»Ñ‚Ð°Ñ‚Ð¸ Ð¾Ñ‚ Ð°Ð½Ð°Ð»Ð¸Ð·Ð°</h2>
                                <button
                                    onClick={resetForm}
                                    className="text-purple-400 hover:text-purple-300"
                                >
                                    â†º ÐÐ¾Ð² Ð°Ð½Ð°Ð»Ð¸Ð·
                                </button>
                            </div>

                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <MetricBlock
                                    label="Ð”Ð¾Ð²ÐµÑ€Ð¸Ðµ"
                                    value={`${Math.round(result.summary.credibilityIndex * 100)}%`}
                                    color={result.summary.credibilityIndex > 0.6 ? 'green' : result.summary.credibilityIndex > 0.4 ? 'yellow' : 'red'}
                                />
                                <MetricBlock
                                    label="ÐœÐ°Ð½Ð¸Ð¿ÑƒÐ»Ð°Ñ†Ð¸Ñ"
                                    value={`${Math.round(result.summary.manipulationIndex * 100)}%`}
                                    color={result.summary.manipulationIndex < 0.3 ? 'green' : result.summary.manipulationIndex < 0.6 ? 'yellow' : 'red'}
                                />
                                <MetricBlock
                                    label="Ð¢Ð²ÑŠÑ€Ð´ÐµÐ½Ð¸Ñ"
                                    value={String(result.claims.length)}
                                    color="blue"
                                />
                                <MetricBlock
                                    label="ÐšÐ»Ð°ÑÐ¸Ñ„Ð¸ÐºÐ°Ñ†Ð¸Ñ"
                                    value={result.summary.finalClassification === 'MIXED' ? 'Ð¡Ð¼ÐµÑÐµÐ½Ð¾' :
                                        result.summary.finalClassification === 'TRUE' ? 'Ð’ÑÑ€Ð½Ð¾' :
                                            result.summary.finalClassification === 'FALSE' ? 'ÐÐµÐ²ÑÑ€Ð½Ð¾' : 'ÐÐµÐ¿Ñ€Ð¾Ð²ÐµÑ€Ð¸Ð¼Ð¾'}
                                    color={result.summary.finalClassification === 'TRUE' ? 'green' :
                                        result.summary.finalClassification === 'MIXED' ? 'yellow' : 'red'}
                                />
                            </div>

                            {/* Usage Info */}
                            {usage && (
                                <div className="bg-slate-700/30 rounded-lg p-4 mb-6">
                                    <h3 className="text-white font-medium mb-2">Ð˜Ð½Ñ„Ð¾Ñ€Ð¼Ð°Ñ†Ð¸Ñ Ð·Ð° Ñ€Ð°Ð·Ñ…Ð¾Ð´Ð°</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-400">Ð¢Ð¾Ñ‡ÐºÐ¸ Ð¸Ð·Ñ€Ð°Ð·Ñ…Ð¾Ð´Ð²Ð°Ð½Ð¸:</span>
                                            <span className="text-white ml-2">{usage.pointsCost}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Token-Ð¸:</span>
                                            <span className="text-white ml-2">{usage.totalTokens}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">ÐÐ¾Ð² Ð±Ð°Ð»Ð°Ð½Ñ:</span>
                                            <span className="text-green-400 ml-2">{usage.newBalance ?? 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Claims */}
                            {result.claims.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-white mb-4">ðŸ” Ð˜Ð´ÐµÐ½Ñ‚Ð¸Ñ„Ð¸Ñ†Ð¸Ñ€Ð°Ð½Ð¸ Ñ‚Ð²ÑŠÑ€Ð´ÐµÐ½Ð¸Ñ</h3>
                                    <div className="space-y-3">
                                        {result.claims.map((claim, idx) => (
                                            <div key={idx} className="bg-slate-700/30 rounded-lg p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className={`px-2 py-1 rounded text-xs font-medium ${claim.veracity === 'Ð²ÑÑ€Ð½Ð¾' ? 'bg-green-500/20 text-green-400' :
                                                            claim.veracity === 'Ð½ÐµÐ²ÑÑ€Ð½Ð¾' ? 'bg-red-500/20 text-red-400' :
                                                                'bg-yellow-500/20 text-yellow-400'
                                                        }`}>
                                                        {claim.veracity}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-gray-200 text-sm mb-2">"{claim.quote}"</p>
                                                        <p className="text-gray-400 text-sm">{claim.explanation}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Overall Summary */}
                            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-6">
                                <h3 className="text-xl font-bold text-white mb-3">ÐžÐ±Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ</h3>
                                <p className="text-gray-300 leading-relaxed">
                                    {result.summary.overallSummary || result.summary.finalInvestigativeReport}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SocialAuditPage;

