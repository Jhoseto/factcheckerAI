import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { analyzeYouTubeStandard } from '../services/geminiService';
import { getYouTubeMetadata } from '../services/youtubeMetadataService';
import { getAllCostEstimates } from '../services/costEstimationService';
import { validateYouTubeUrl, validateNewsUrl } from '../services/validation';
import { analyzeLinkDeep } from '../services/linkAudit/linkService';
import { FIXED_PRICES } from '../config/pricingConfig';
import type { AnalysisMode, YouTubeVideoMetadata, CostEstimate } from '../types';
import MobileSafeArea from './components/MobileSafeArea';
import MobileHeader from './components/MobileHeader';

const LOADING_PHASES = [
  'Изпращане на заявка...',
  'Анализиране на видеото...',
  'Проверка на твърдения...',
  'Финализиране на доклада...',
];

const MobileAudit: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, updateLocalBalance, refreshProfile } = useAuth();

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<YouTubeVideoMetadata | null>(null);
  const [costEstimates, setCostEstimates] = useState<Record<AnalysisMode, CostEstimate> | null>(null);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [streamingProgress, setStreamingProgress] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!youtubeUrl.trim()) {
      setVideoMetadata(null);
      setCostEstimates(null);
      return;
    }
    setFetchingMetadata(true);
    setError(null);
    const timeoutId = setTimeout(async () => {
      try {
        const metadata = await getYouTubeMetadata(youtubeUrl);
        setVideoMetadata(metadata);
        setCostEstimates(getAllCostEstimates(metadata.duration));
      } catch {
        setVideoMetadata(null);
        setCostEstimates(null);
        setError('Невалиден линк или видео.');
      } finally {
        setFetchingMetadata(false);
      }
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [youtubeUrl]);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setLoadingPhase(p => (p + 1) % LOADING_PHASES.length), 3500);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    if (!loading && !linkLoading) {
      setElapsedSeconds(0);
      return;
    }
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading, linkLoading]);

  const handleStartAnalysis = async () => {
    if (!analysisMode) {
      setError('Изберете режим на одит.');
      return;
    }
    const validation = validateYouTubeUrl(youtubeUrl);
    if (!validation.valid) {
      setError(validation.error || 'Невалиден YouTube URL.');
      return;
    }
    if (!currentUser) {
      setError('Влезте в профила си.');
      setTimeout(() => navigate('/login'), 1500);
      return;
    }
    const estimatedCost = costEstimates?.[analysisMode]?.pointsCost ?? (analysisMode === 'deep' ? 10 : 5);
    if (userProfile && userProfile.pointsBalance < estimatedCost) {
      setError(`Нужни са ${estimatedCost} точки. Купете от Pricing.`);
      return;
    }

    setLoading(true);
    setError(null);
    setElapsedSeconds(0);
    try {
      const response = await analyzeYouTubeStandard(
        youtubeUrl,
        videoMetadata || undefined,
        'gemini-2.5-flash',
        analysisMode,
        (status) => setStreamingProgress(status)
      );
      if (response.usage?.newBalance !== undefined) updateLocalBalance(response.usage.newBalance);
      else refreshProfile();
      navigate('/analysis-result', { state: { analysis: response.analysis, type: 'video', url: youtubeUrl } });
    } catch (e: any) {
      if (e.code === 'INSUFFICIENT_POINTS') setError('Недостатъчно точки.');
      else if (e.code === 'RATE_LIMIT') setError('Изчакайте 1–2 мин.');
      else setError('Грешка при анализа. Опитайте отново.');
    } finally {
      setLoading(false);
      setStreamingProgress(null);
    }
  };

  const handleStartLinkAnalysis = async () => {
    if (!linkUrl.trim()) return;
    const validation = validateNewsUrl(linkUrl);
    if (!validation.valid) {
      setError(validation.error || 'Невалиден URL адрес.');
      return;
    }
    if (!currentUser) {
      setError('Влезте в профила си.');
      setTimeout(() => navigate('/login'), 1500);
      return;
    }
    if (userProfile && userProfile.pointsBalance < FIXED_PRICES.linkArticle) {
      setError(`Нужни са ${FIXED_PRICES.linkArticle} точки. Купете от Pricing.`);
      return;
    }

    setLinkLoading(true);
    setError(null);
    setElapsedSeconds(0);
    try {
      const { analysis: result, usage } = await analyzeLinkDeep(linkUrl, (status) => {
        setStreamingProgress(status);
      });
      if (usage?.newBalance !== undefined) updateLocalBalance(usage.newBalance);
      else refreshProfile();
      navigate('/analysis-result', { state: { analysis: result, type: 'link', url: linkUrl } });
    } catch (e: any) {
      if (e.code === 'INSUFFICIENT_POINTS') setError('Недостатъчно точки.');
      else if (e.code === 'RATE_LIMIT') setError('Изчакайте 1–2 мин.');
      else setError('Грешка при анализа. Опитайте отново.');
    } finally {
      setLinkLoading(false);
      setStreamingProgress(null);
    }
  };

  if (loading || linkLoading) {
    return (
      <MobileSafeArea className="flex flex-col bg-white">
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-[280px] h-1 bg-slate-100 rounded-full overflow-hidden mb-8">
            <div className="h-full w-1/2 bg-amber-900 rounded-full mobile-loading-bar" />
          </div>
          <p className="text-[10px] font-black text-amber-900 uppercase tracking-[0.3em] mb-2">Одит на истината</p>
          <p className="text-2xl font-mono font-black text-slate-900 tabular-nums tracking-tight">
            {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
          </p>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-4 text-center min-h-[3rem]">
            {streamingProgress || LOADING_PHASES[loadingPhase]}
          </p>
        </div>
      </MobileSafeArea>
    );
  }

  return (
    <MobileSafeArea>
      <MobileHeader title="Одит" />
      <main className="flex flex-col flex-1 px-4 pt-6 pb-8 overflow-y-auto">
        {/* YouTube Video Section */}
        <div className="relative mb-6 mobile-fade-in">
          <div className="rounded-2xl bg-gradient-to-br from-amber-50/50 via-white to-amber-50/30 border border-amber-900/10 p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="h-[1px] w-8 bg-amber-900/40" />
              <span className="text-[10px] font-black text-amber-900 uppercase tracking-[0.4em]">YouTube Видео Одит</span>
              <span className="h-[1px] w-8 bg-amber-900/40" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight italic serif text-center mb-6">
              Анализирай <span className="text-amber-900">видео</span> поток
            </h2>

            <div className="mobile-editorial-card rounded-xl overflow-hidden mb-5 mobile-fade-in-delay-1">
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="Поставете YouTube линк..."
                className="w-full px-4 py-4 text-base text-slate-900 font-bold placeholder:text-slate-400 focus:outline-none focus-visible:ring-0 bg-transparent"
              />
              {fetchingMetadata && (
                <div className="px-4 pb-3 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Зареждане...</span>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 mobile-fade-in">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            )}

            {videoMetadata && !fetchingMetadata && (
              <div className="mobile-editorial-card rounded-xl p-4 mb-5 flex items-center gap-4 mobile-fade-in">
                <span className="text-2xl">📹</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900 truncate">{videoMetadata.title}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{videoMetadata.author} · {videoMetadata.durationFormatted}</p>
                </div>
              </div>
            )}

            {costEstimates && (
              <div className="space-y-4 mb-6 mobile-fade-in mobile-fade-in-delay-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Режим на одит</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAnalysisMode('standard')}
                    className={`mobile-tap rounded-xl border-2 p-4 text-left transition-all duration-200 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-900/20 focus-visible:ring-offset-2 ${
                      analysisMode === 'standard'
                        ? 'border-amber-900 bg-amber-50/50 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]'
                        : 'border-slate-100 bg-white active:border-amber-900/30'
                    }`}
                  >
                    <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">Стандартен Одит</p>
                    <p className="text-xl font-black text-slate-900 mt-1">
                      {costEstimates.standard.pointsCost} <span className="text-xs uppercase opacity-40">точки</span>
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisMode('deep')}
                    className={`mobile-tap rounded-xl border-2 p-4 text-left transition-all duration-200 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2 ${
                      analysisMode === 'deep'
                        ? 'border-slate-900 bg-slate-50 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]'
                        : 'border-slate-100 bg-white active:border-slate-900/30'
                    }`}
                  >
                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Задълбочен Одит</p>
                    <p className="text-xl font-black text-slate-900 mt-1">
                      {costEstimates.deep.pointsCost} <span className="text-xs uppercase opacity-40">точки</span>
                    </p>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  disabled={!analysisMode}
                  className="mobile-tap w-full py-4 rounded-xl bg-amber-900 text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-200 disabled:opacity-50 disabled:active:scale-100 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-900/30 focus-visible:ring-offset-2 hover:bg-slate-900 active:scale-[0.98]"
                >
                  Одит
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="relative my-8 mobile-fade-in">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200/60"></div>
          </div>
          <div className="relative flex justify-center">
            <div className="bg-white px-4">
              <div className="h-1 w-16 bg-gradient-to-r from-transparent via-amber-900/20 to-transparent rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Link Audit Section */}
        <div className="relative mobile-fade-in">
          <div className="rounded-2xl bg-gradient-to-br from-slate-50/50 via-white to-slate-50/30 border border-slate-900/10 p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="h-[1px] w-8 bg-slate-900/40" />
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em]">Линк Одит</span>
              <span className="h-[1px] w-8 bg-slate-900/40" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight italic serif mb-6 text-center">
              Анализирай <span className="text-slate-900">статия</span> или новина
            </h2>

            <div className="mobile-editorial-card rounded-xl overflow-hidden mb-4">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://news-site.bg/ime-na-statiata..."
                className="w-full px-4 py-4 text-base text-slate-900 font-bold placeholder:text-slate-400 focus:outline-none focus-visible:ring-0 bg-transparent"
                disabled={linkLoading}
              />
            </div>

            <button
              type="button"
              onClick={handleStartLinkAnalysis}
              disabled={!linkUrl.trim() || linkLoading}
              className="mobile-tap w-full py-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-200 disabled:opacity-50 disabled:active:scale-100 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              {linkLoading ? 'Анализира се...' : `Одит (${FIXED_PRICES.linkArticle} точки)`}
            </button>
          </div>
        </div>
      </main>
    </MobileSafeArea>
  );
};

export default MobileAudit;
