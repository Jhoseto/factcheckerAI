import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

const LOADING_PHASE_KEYS = ['mobile.loadingPhase1', 'mobile.loadingPhase2', 'mobile.loadingPhase3', 'mobile.loadingPhase4'] as const;

const MobileAudit: React.FC = () => {
  const { t } = useTranslation();
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
        setError(t('mobile.invalidLinkOrVideo'));
      } finally {
        setFetchingMetadata(false);
      }
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [youtubeUrl]);

  useEffect(() => {
    if (!loading) return;
    const phaseTimer = setInterval(() => setLoadingPhase(p => (p + 1) % LOADING_PHASE_KEYS.length), 3500);
    return () => clearInterval(phaseTimer);
  }, [loading]);

  useEffect(() => {
    if (!loading && !linkLoading) {
      setElapsedSeconds(0);
      return;
    }
    const elapsedTimer = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(elapsedTimer);
  }, [loading, linkLoading]);

  const handleStartAnalysis = async () => {
    if (!analysisMode) {
      setError(t('mobile.selectAuditMode'));
      return;
    }
    const validation = validateYouTubeUrl(youtubeUrl);
    if (!validation.valid) {
      setError(t('errors.invalidYoutubeUrl'));
      return;
    }
    if (!currentUser) {
      setError(t('mobile.loginRequired'));
      setTimeout(() => navigate('/login'), 1500);
      return;
    }
    const estimatedCost = costEstimates?.[analysisMode]?.pointsCost ?? (analysisMode === 'deep' ? 10 : 5);
    if (userProfile && userProfile.pointsBalance < estimatedCost) {
      setError(t('common.needPointsBuy', { count: estimatedCost }));
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
      if (e.code === 'INSUFFICIENT_POINTS') setError(t('errors.insufficientPointsShort'));
      else if (e.code === 'RATE_LIMIT') setError(t('errors.rateLimitWait'));
      else setError(t('errors.analysisError'));
    } finally {
      setLoading(false);
      setStreamingProgress(null);
    }
  };

  const handleStartLinkAnalysis = async () => {
    if (!linkUrl.trim()) return;
    const validation = validateNewsUrl(linkUrl);
    if (!validation.valid) {
      setError(t('linkAudit.invalidUrl'));
      return;
    }
    if (!currentUser) {
      setError(t('mobile.loginRequired'));
      setTimeout(() => navigate('/login'), 1500);
      return;
    }
    if (userProfile && userProfile.pointsBalance < FIXED_PRICES.linkArticle) {
      setError(t('common.needPointsBuy', { count: FIXED_PRICES.linkArticle }));
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
      if (e.code === 'INSUFFICIENT_POINTS') setError(t('errors.insufficientPointsShort'));
      else if (e.code === 'RATE_LIMIT') setError(t('errors.rateLimitWait'));
      else setError(t('errors.analysisError'));
    } finally {
      setLinkLoading(false);
      setStreamingProgress(null);
    }
  };

  if (loading || linkLoading) {
    return (
      <MobileSafeArea className="flex flex-col relative overflow-hidden bg-[#111]">
        {/* Subtle background glow for loading */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[50%] bg-[#C4B091] opacity-[0.05] blur-[100px] rounded-full mix-blend-screen pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8">
          <div className="w-full max-w-[240px] h-1.5 bg-[#252525] border border-[#333] rounded-full overflow-hidden mb-10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
            <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-[#C4B091] to-transparent rounded-full mobile-loading-bar" />
          </div>

          <div className="flex flex-col items-center gap-1 mb-6">
            <p className="text-[9px] font-black text-[#888] uppercase tracking-[0.4em] mb-1">{t('loading.title')}</p>
            <p className="text-4xl font-serif text-[#E0E0E0] tabular-nums tracking-tight drop-shadow-[0_2px_10px_rgba(196,176,145,0.2)]">
              {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}<span className="text-[#968B74] mx-1">:</span>{String(elapsedSeconds % 60).padStart(2, '0')}
            </p>
          </div>

          <div className="h-12 flex items-center justify-center">
            <p className="text-[10px] font-bold text-[#C4B091] uppercase tracking-[0.2em] text-center animate-pulse">
              {streamingProgress || t(LOADING_PHASE_KEYS[loadingPhase])}
            </p>
          </div>
        </div>
      </MobileSafeArea>
    );
  }

  return (
    <MobileSafeArea className="bg-[#111]">
      <MobileHeader title={t('mobile.audit')} />
      <main className="flex flex-col flex-1 px-4 pt-6 pb-24 overflow-y-auto">
        {/* YouTube Video Section */}
        <div className="relative mb-8 mobile-fade-in">
          <div className="mobile-glass rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
            {/* Subtle inner highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C4B091]/20 to-transparent" />

            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="h-[1px] w-6 bg-gradient-to-r from-transparent to-[#968B74]/50" />
              <span className="text-[9px] font-black text-[#C4B091] uppercase tracking-[0.4em]">{t('mobile.youtubeVideoAudit')}</span>
              <span className="h-[1px] w-6 bg-gradient-to-l from-transparent to-[#968B74]/50" />
            </div>
            <h2 className="text-2xl font-serif font-black text-[#E0E0E0] tracking-tight leading-tight text-center mb-6">
              {t('mobile.analyzeVideoStream')}
            </h2>

            <div className="rounded-xl border border-[#333] bg-[#1a1a1a] shadow-inner overflow-hidden mb-5 mobile-fade-in-delay-1 transition-all focus-within:border-[#968B74]/40 focus-within:shadow-[0_0_15px_rgba(196,176,145,0.1)]">
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder={t('mobile.placeholderYoutube')}
                className="w-full px-5 py-4 min-h-[52px] text-sm text-[#E0E0E0] font-medium placeholder:text-[#666] outline-none bg-transparent"
              />
              {fetchingMetadata && (
                <div className="px-5 pb-4 flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-[#333] border-t-[#C4B091] rounded-full animate-spin" />
                  <span className="text-[9px] font-bold text-[#888] uppercase tracking-wider">{t('mobile.loading')}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-red-950/30 border border-red-900/40 mobile-fade-in">
                <p className="text-sm font-medium text-red-400 text-center">{error}</p>
              </div>
            )}

            {videoMetadata && !fetchingMetadata && (
              <div className="rounded-xl border border-[#333] bg-[#1a1a1a] p-4 mb-6 flex items-center gap-4 mobile-fade-in shadow-md">
                <span className="text-3xl drop-shadow-md">📹</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-[#E0E0E0] truncate leading-tight mb-1">{videoMetadata.title}</p>
                  <p className="text-[10px] text-[#A89F91] font-bold uppercase tracking-wider">{videoMetadata.author} · {videoMetadata.durationFormatted}</p>
                </div>
              </div>
            )}

            {costEstimates && (
              <div className="space-y-5 mb-2 mobile-fade-in mobile-fade-in-delay-2">
                <p className="text-[9px] font-black text-[#888] uppercase tracking-[0.3em] text-center">{t('mobile.auditMode')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAnalysisMode('standard')}
                    className={`mobile-tap rounded-xl border p-4 text-center transition-all duration-200 touch-manipulation focus:outline-none ${analysisMode === 'standard'
                        ? 'border-[#C4B091] bg-gradient-to-b from-[#968B74]/20 to-[#968B74]/5 shadow-[0_4px_15px_rgba(196,176,145,0.15)]'
                        : 'border-[#333] bg-[#1a1a1a]'
                      }`}
                  >
                    <p className="text-[10px] font-black text-[#C4B091] uppercase tracking-[0.2em] mb-1">{t('app.standardLabel')}</p>
                    <p className="text-xl font-serif text-[#E0E0E0]">
                      {costEstimates.standard.pointsCost} <span className="text-[10px] text-[#888] uppercase font-sans tracking-widest">{t('mobile.pointsLabel')}</span>
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisMode('deep')}
                    className={`mobile-tap rounded-xl border p-4 text-center transition-all duration-200 touch-manipulation focus:outline-none relative overflow-hidden ${analysisMode === 'deep'
                        ? 'border-[#C4B091] bg-gradient-to-b from-[#968B74]/20 to-[#968B74]/5 shadow-[0_4px_15px_rgba(196,176,145,0.15)]'
                        : 'border-[#333] bg-[#1a1a1a]'
                      }`}
                  >
                    {/* Deep mode premium hint */}
                    <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-[#C4B091]/20 to-transparent rounded-bl-full pointer-events-none" />
                    <p className="text-[10px] font-black text-[#C4B091] uppercase tracking-[0.2em] mb-1 relative z-10">{t('app.deepLabel')}</p>
                    <p className="text-xl font-serif text-[#E0E0E0] relative z-10">
                      {costEstimates.deep.pointsCost} <span className="text-[10px] text-[#888] uppercase font-sans tracking-widest">{t('mobile.pointsLabel')}</span>
                    </p>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleStartAnalysis}
                    disabled={!analysisMode}
                    className="mobile-tap w-full py-4 rounded-xl bg-gradient-to-r from-[#C4B091] to-[#968B74] text-[#111] text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_4px_15px_rgba(196,176,145,0.3)] transition-all duration-200 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B091] active:scale-[0.98]"
                  >
                    {t('mobile.audit')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="relative my-8 mobile-fade-in flex items-center justify-center">
          <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-[#333] to-transparent" />
          <div className="relative z-10 w-2 h-2 rounded-full bg-[#333] border-2 border-[#111]" />
        </div>

        {/* Link Audit Section */}
        <div className="relative mobile-fade-in">
          <div className="mobile-glass rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C4B091]/20 to-transparent" />
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="h-[1px] w-6 bg-gradient-to-r from-transparent to-[#968B74]/50" />
              <span className="text-[9px] font-black text-[#C4B091] uppercase tracking-[0.4em]">{t('mobile.linkAuditSection')}</span>
              <span className="h-[1px] w-6 bg-gradient-to-l from-transparent to-[#968B74]/50" />
            </div>
            <h2 className="text-2xl font-serif font-black text-[#E0E0E0] tracking-tight leading-tight mb-6 text-center">
              {t('mobile.analyzeArticle')}
            </h2>

            <div className="rounded-xl border border-[#333] bg-[#1a1a1a] shadow-inner overflow-hidden mb-5 transition-all focus-within:border-[#968B74]/40 focus-within:shadow-[0_0_15px_rgba(196,176,145,0.1)]">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder={t('mobile.placeholderLink')}
                className="w-full px-5 py-4 min-h-[52px] text-sm text-[#E0E0E0] font-medium placeholder:text-[#666] outline-none bg-transparent"
                disabled={linkLoading}
              />
            </div>

            <button
              type="button"
              onClick={handleStartLinkAnalysis}
              disabled={!linkUrl.trim() || linkLoading}
              className="mobile-tap w-full py-4 rounded-xl bg-gradient-to-r from-[#C4B091] to-[#968B74] text-[#111] text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_4px_15px_rgba(196,176,145,0.3)] transition-all duration-200 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B091] active:scale-[0.98]"
            >
              {linkLoading ? t('mobile.analyzing') : t('mobile.auditPoints', { count: FIXED_PRICES.linkArticle })}
            </button>
          </div>
        </div>
      </main>
    </MobileSafeArea>
  );
};

export default MobileAudit;
