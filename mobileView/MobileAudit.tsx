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
    const t = setInterval(() => setLoadingPhase(p => (p + 1) % LOADING_PHASE_KEYS.length), 3500);
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
      <MobileSafeArea className="flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-[280px] h-1 bg-[#333] rounded-full overflow-hidden mb-8">
            <div className="h-full w-1/2 bg-[#968B74] rounded-full mobile-loading-bar" />
          </div>
          <p className="text-[10px] font-black text-[#C4B091] uppercase tracking-[0.3em] mb-2">{t('loading.title')}</p>
          <p className="text-2xl font-mono font-black text-[#E0E0E0] tabular-nums tracking-tight">
            {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
          </p>
          <p className="text-[10px] font-black text-[#888] uppercase tracking-widest mt-4 text-center min-h-[3rem]">
            {streamingProgress || t(LOADING_PHASE_KEYS[loadingPhase])}
          </p>
        </div>
      </MobileSafeArea>
    );
  }

  return (
    <MobileSafeArea>
      <MobileHeader title={t('mobile.audit')} />
      <main className="flex flex-col flex-1 px-4 pt-6 pb-24 overflow-y-auto">
        {/* YouTube Video Section */}
        <div className="relative mb-6 mobile-fade-in">
          <div className="rounded-2xl bg-[#252525] border border-[#333] p-5 sm:p-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="h-[1px] w-8 bg-[#968B74]/40" />
              <span className="text-[10px] font-black text-[#C4B091] uppercase tracking-[0.4em]">{t('mobile.youtubeVideoAudit')}</span>
              <span className="h-[1px] w-8 bg-[#968B74]/40" />
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-black text-[#E0E0E0] tracking-tight leading-tight text-center mb-5">
              {t('mobile.analyzeVideoStream')}
            </h2>

            <div className="rounded-xl border border-[#333] bg-[#1a1a1a] overflow-hidden mb-4 mobile-fade-in-delay-1">
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder={t('mobile.placeholderYoutube')}
                className="w-full px-4 py-3.5 min-h-[44px] text-base text-[#E0E0E0] font-medium placeholder:text-[#666] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#968B74]/40 bg-transparent"
              />
              {fetchingMetadata && (
                <div className="px-4 pb-3 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#333] border-t-[#968B74] rounded-full animate-spin" />
                  <span className="text-[10px] font-bold text-[#888] uppercase tracking-wider">{t('mobile.loading')}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-900/20 border border-red-800/50 mobile-fade-in">
                <p className="text-sm font-medium text-red-300">{error}</p>
              </div>
            )}

            {videoMetadata && !fetchingMetadata && (
              <div className="rounded-xl border border-[#333] bg-[#1a1a1a] p-4 mb-4 flex items-center gap-4 mobile-fade-in">
                <span className="text-2xl">📹</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-[#E0E0E0] truncate">{videoMetadata.title}</p>
                  <p className="text-[10px] text-[#888] font-bold uppercase tracking-wider mt-0.5">{videoMetadata.author} · {videoMetadata.durationFormatted}</p>
                </div>
              </div>
            )}

            {costEstimates && (
              <div className="space-y-4 mb-6 mobile-fade-in mobile-fade-in-delay-2">
                <p className="text-[10px] font-black text-[#888] uppercase tracking-widest text-center">{t('mobile.auditMode')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAnalysisMode('standard')}
                    className={`mobile-tap rounded-xl border-2 p-4 min-h-[44px] text-left transition-all duration-200 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#968B74]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] ${
                      analysisMode === 'standard'
                        ? 'border-[#968B74] bg-[#968B74]/15'
                        : 'border-[#333] bg-[#1a1a1a] active:border-[#968B74]/50'
                    }`}
                  >
                    <p className="text-[10px] font-black text-[#C4B091] uppercase tracking-widest">{t('app.standardLabel')}</p>
                    <p className="text-lg font-black text-[#E0E0E0] mt-1">
                      {costEstimates.standard.pointsCost} <span className="text-xs text-[#888] uppercase">{t('mobile.pointsLabel')}</span>
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisMode('deep')}
                    className={`mobile-tap rounded-xl border-2 p-4 min-h-[44px] text-left transition-all duration-200 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#968B74]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] ${
                      analysisMode === 'deep'
                        ? 'border-[#968B74] bg-[#968B74]/15'
                        : 'border-[#333] bg-[#1a1a1a] active:border-[#968B74]/50'
                    }`}
                  >
                    <p className="text-[10px] font-black text-[#C4B091] uppercase tracking-widest">{t('app.deepLabel')}</p>
                    <p className="text-lg font-black text-[#E0E0E0] mt-1">
                      {costEstimates.deep.pointsCost} <span className="text-xs text-[#888] uppercase">{t('mobile.pointsLabel')}</span>
                    </p>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  disabled={!analysisMode}
                  className="mobile-tap w-full py-3.5 min-h-[48px] rounded-xl bg-[#968B74] text-[#1a1a1a] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-200 disabled:opacity-50 disabled:active:scale-100 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B091] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] active:scale-[0.98]"
                >
                  {t('mobile.audit')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="relative my-6 mobile-fade-in">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#333]" />
          </div>
          <div className="relative flex justify-center">
            <div className="bg-[#1a1a1a] px-4">
              <div className="h-1 w-16 bg-gradient-to-r from-transparent via-[#968B74]/30 to-transparent rounded-full" />
            </div>
          </div>
        </div>

        {/* Link Audit Section */}
        <div className="relative mobile-fade-in">
          <div className="rounded-2xl bg-[#252525] border border-[#333] p-5 sm:p-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="h-[1px] w-8 bg-[#968B74]/40" />
              <span className="text-[10px] font-black text-[#C4B091] uppercase tracking-[0.4em]">{t('mobile.linkAuditSection')}</span>
              <span className="h-[1px] w-8 bg-[#968B74]/40" />
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-black text-[#E0E0E0] tracking-tight leading-tight mb-5 text-center">
              {t('mobile.analyzeArticle')}
            </h2>

            <div className="rounded-xl border border-[#333] bg-[#1a1a1a] overflow-hidden mb-4">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder={t('mobile.placeholderLink')}
                className="w-full px-4 py-3.5 min-h-[44px] text-base text-[#E0E0E0] font-medium placeholder:text-[#666] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#968B74]/40 bg-transparent"
                disabled={linkLoading}
              />
            </div>

            <button
              type="button"
              onClick={handleStartLinkAnalysis}
              disabled={!linkUrl.trim() || linkLoading}
              className="mobile-tap w-full py-3.5 min-h-[48px] rounded-xl bg-[#968B74] text-[#1a1a1a] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-200 disabled:opacity-50 disabled:active:scale-100 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B091] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] active:scale-[0.98]"
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
