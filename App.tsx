import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import html2canvas from 'html2canvas';
import { analyzeYouTubeStandard, synthesizeReport } from './services/geminiService';
import { VideoAnalysis, APIUsage, AnalysisMode, YouTubeVideoMetadata, CostEstimate } from './types';
import ReliabilityChart from './components/ReliabilityChart';
import { getYouTubeMetadata } from './services/youtubeMetadataService';
import { getAllCostEstimates } from './services/costEstimationService';
import { validateYouTubeUrl } from './services/validation';
import { useAuth } from './contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import PointsWidget from './components/user/PointsWidget';
import LinkAuditPage from './components/linkAudit/LinkAuditPage';
import ScannerAnimation from './components/common/ScannerAnimation';
import VideoResultView from './components/common/result-views/VideoResultView';
import AnalysisLoadingOverlay from './components/common/AnalysisLoadingOverlay';
import { saveAnalysis } from './services/archiveService';

const App: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  
  const { currentUser, userProfile, updateLocalBalance, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [analysisMode, setAnalysisMode] = useState<AnalysisMode | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<YouTubeVideoMetadata | null>(null);
  const [costEstimates, setCostEstimates] = useState<Record<AnalysisMode, CostEstimate> | null>(null);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!youtubeUrl.trim()) {
        setVideoMetadata(null);
        setCostEstimates(null);
        return;
      }
      setFetchingMetadata(true);
      setError(null);
      try {
        const metadata = await getYouTubeMetadata(youtubeUrl);
        setVideoMetadata(metadata);
        const estimates = getAllCostEstimates(metadata.duration);
        setCostEstimates(estimates);
        if (!analysisMode) setAnalysisMode('standard');
      } catch (e: any) {
        console.error('[Metadata Error]', e);
        setError(t('errors.metadata'));
        setVideoMetadata(null);
      } finally {
        setFetchingMetadata(false);
      }
    };
    const timeoutId = setTimeout(fetchMetadata, 800);
    return () => clearTimeout(timeoutId);
  }, [youtubeUrl]);

  const handleStartAnalysis = async () => {
    const url = youtubeUrl;
    const validation = validateYouTubeUrl(url);
    if (!validation.valid) { setError(t('errors.invalidYoutubeUrl')); return; }
    if (!currentUser) { navigate('/login'); return; }
    
    let estimatedCost = 10;
    if (costEstimates && analysisMode && costEstimates[analysisMode]) {
      estimatedCost = costEstimates[analysisMode].pointsCost;
    }
    if (userProfile && userProfile.pointsBalance < estimatedCost) {
      setError(t('errors.insufficientPoints', { count: estimatedCost }));
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);
    
    try {
      const response = await analyzeYouTubeStandard(url, videoMetadata || undefined, 'gemini-2.5-flash', analysisMode || 'standard', setStreamingProgress);
      navigate('/analysis-result', { state: { analysis: response.analysis, type: 'video', url: youtubeUrl } });
      if (response.usage?.newBalance !== undefined) updateLocalBalance(response.usage.newBalance);
      else refreshProfile();
    } catch (e: any) {
      setError(e.message || t('errors.analysisFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-sans selection:bg-[#968B74] selection:text-white overflow-x-hidden relative">
      
      <AnalysisLoadingOverlay visible={loading} streamingProgress={streamingProgress} />

      {/* Background Layers */}
      <div className="premium-bg-wrapper">
          <div className="premium-wave-1"></div>
          <div className="premium-wave-2"></div>
          <div className="premium-wave-3"></div>
          <div className="premium-texture"></div>
          <div className="premium-particles">
              {[...Array(32)].map((_, i) => (
                  <div 
                      key={`p-${i}`} 
                      className="particle"
                      style={{
                          left: `${(i * 3.1 + 7) % 98}%`,
                          width: `${(i % 3) * 0.8 + 1.2}px`,
                          height: `${(i % 3) * 0.8 + 1.2}px`,
                          animationDelay: `${(i * 0.7) % 8}s`,
                          animationDuration: `${12 + (i % 6)}s`
                      }}
                  ></div>
              ))}
              {[...Array(24)].map((_, i) => (
                  <div 
                      key={`b-${i}`} 
                      className="particle-balloon"
                      style={{
                          left: `${(i * 4.2 + 2) % 96}%`,
                          width: `${(i % 4) * 1.5 + 3}px`,
                          height: `${(i % 4) * 1.5 + 3}px`,
                          animationDelay: `${(i * 1.3) % 14}s`
                      }}
                  ></div>
              ))}
          </div>
      </div>

      {/* 1. HERO HEADER (Animation + Title) */}
      <div className="relative pt-32 pb-16 flex flex-col items-center justify-center text-center z-10 px-4">
        
        {/* Animation - extra wide, same height */}
        <div className="mb-10 opacity-90 mix-blend-screen flex justify-center" style={{ width: 'min(100%, 960px)', height: 180 }}>
           <ScannerAnimation size={180} width={480} height={180} />
        </div>

        <div className="max-w-4xl space-y-6 animate-fadeUp">
          {/* Заглавие с хоризонт на събитията точно между двата реда */}
          <div className="hero-title-wrap relative flex flex-col items-center">
            <div className="hero-blackhole-bg" aria-hidden />
            <div className="hero-saturn-ring" aria-hidden />
            <h1 className="relative z-10 text-6xl md:text-8xl lg:text-9xl font-serif text-white tracking-tight leading-[1] drop-shadow-2xl">
              {t('app.heroTitle').split(' ').slice(0, 2).join(' ')} <span className="italic text-bronze-gradient">{t('app.heroTitle').split(' ').slice(2).join(' ')}</span>
            </h1>
          </div>

          <p className="text-[#bbb] text-sm md:text-base max-w-3xl mx-auto leading-relaxed font-light tracking-wide opacity-90 text-center">
            {t('app.heroSubtitle')}
          </p>
        </div>
      </div>

      {/* 2. VIDEO AUDIT SECTION (Separated) */}
      <section id="video-analysis" className="relative py-24 z-10">
         {/* Divider */}
         <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#968B74]/20 to-transparent"></div>

         <div className="max-w-5xl mx-auto px-6 text-center animate-fadeUp">
            <div className="mb-12 space-y-4">
                <div className="flex items-center justify-center gap-4 opacity-50">
                    <div className="h-[1px] w-12 bg-[#968B74]"></div>
                    <span className="text-[10px] font-bold text-[#C4B091] uppercase tracking-[0.4em]">{t('app.videoAnalysis')}</span>
                    <div className="h-[1px] w-12 bg-[#968B74]"></div>
                </div>
                <h2 className="text-3xl md:text-4xl font-serif text-[#E0E0E0]">
                    {t('app.youtubeAudit')}
                </h2>
            </div>

            <div className="max-w-3xl mx-auto editorial-card p-4 md:p-6 bg-[#2E2E2E]/80 backdrop-blur-xl">
                <div className="relative flex flex-col md:flex-row items-center gap-4 p-2">
                  <input 
                    type="text" 
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder={t('app.youtubePlaceholder')} 
                    className="input-luxury w-full flex-1 px-6 py-4 rounded text-sm placeholder:text-[#666] tracking-wide"
                  />
                  <button 
                    onClick={handleStartAnalysis}
                    disabled={loading}
                    className="btn-luxury-solid w-full md:w-auto px-10 py-4 rounded text-[10px] uppercase tracking-[0.2em] whitespace-nowrap"
                  >
                    {loading ? t('app.analyzing') : t('app.execute')}
                  </button>
                </div>

                {/* Metadata Preview + Стандартен/Дълбок анализ + Транскрипция */}
                {videoMetadata && !fetchingMetadata && (
                  <>
                    <div className="mt-6 border-t border-[#444] pt-6 flex items-center gap-4 text-left">
                        <div className="w-16 h-10 bg-[#222] rounded overflow-hidden relative">
                            <img src={videoMetadata.thumbnailUrl || ''} className="w-full h-full object-cover opacity-60" alt="" />
                        </div>
                        <div>
                          <p className="text-[10px] text-[#968B74] font-bold uppercase tracking-wider">{t('app.discoveredSource')}</p>
                          <p className="text-xs text-[#ddd] font-medium truncate max-w-[200px]">{videoMetadata.title}</p>
                        </div>
                    </div>
                    {costEstimates && (
                      <>
                        <div className="mt-5 flex flex-wrap gap-4 justify-center">
                          <div className="group relative">
                            <button
                              type="button"
                              onClick={() => setAnalysisMode('standard')}
                              className={`video-mode-btn px-5 py-3 rounded-lg border text-left min-w-[180px] transition-all duration-300 ${analysisMode === 'standard' ? 'border-[#968B74] bg-[#968B74]/15 text-[#C4B091]' : 'border-[#444] text-[#888] hover:border-[#968B74]/50 hover:text-[#bbb]'}`}
                            >
                              <span className="block text-[11px] font-bold uppercase tracking-wider">{t('app.standardLabel')}</span>
                              <span className="block text-[10px] text-[#968B74] mt-0.5">{t('app.pointsCost', { count: costEstimates.standard.pointsCost })}</span>
                            </button>
                            <div className="video-mode-tooltip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2.5 rounded-lg border border-[#968B74]/30 bg-[#1a1a1a] shadow-xl opacity-0 invisible scale-95 translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-hover:translate-y-0 transition-all duration-200 ease-out pointer-events-none z-20 w-56 text-left">
                              <p className="text-[11px] text-[#C4B091]/95 leading-relaxed">{t('app.standardTooltip')}</p>
                              <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-[#1a1a1a]" />
                            </div>
                          </div>
                          <div className="group relative">
                            <button
                              type="button"
                              onClick={() => setAnalysisMode('deep')}
                              className={`video-mode-btn px-5 py-3 rounded-lg border text-left min-w-[180px] transition-all duration-300 ${analysisMode === 'deep' ? 'border-[#968B74] bg-[#968B74]/15 text-[#C4B091]' : 'border-[#444] text-[#888] hover:border-[#968B74]/50 hover:text-[#bbb]'}`}
                            >
                              <span className="block text-[11px] font-bold uppercase tracking-wider">{t('app.deepLabel')}</span>
                              <span className="block text-[10px] text-[#968B74] mt-0.5">{t('app.pointsCost', { count: costEstimates.deep.pointsCost })}</span>
                            </button>
                            <div className="video-mode-tooltip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2.5 rounded-lg border border-[#968B74]/30 bg-[#1a1a1a] shadow-xl opacity-0 invisible scale-95 translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-hover:translate-y-0 transition-all duration-200 ease-out pointer-events-none z-20 w-56 text-left">
                              <p className="text-[11px] text-[#C4B091]/95 leading-relaxed">{t('app.deepTooltip')}</p>
                              <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-[#1a1a1a]" />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {error && <p className="text-red-400 text-xs tracking-wide mt-4 font-bold p-3 bg-red-900/10 rounded border border-red-900/20">{error}</p>}
            </div>
         </div>
      </section>

      {/* 3. LINK AUDIT SECTION */}
      <LinkAuditPage />
    </div>
  );
};

export default App;
