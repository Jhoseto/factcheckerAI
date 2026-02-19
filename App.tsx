
import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { analyzeYouTubeStandard, synthesizeReport } from './services/geminiService';
import { VideoAnalysis, APIUsage, AnalysisMode, YouTubeVideoMetadata, CostEstimate } from './types';
import ReliabilityChart from './components/ReliabilityChart';
// AnalysisModeSelector removed (inlined)
import { getYouTubeMetadata } from './services/youtubeMetadataService';
import { getAllCostEstimates } from './services/costEstimationService';
import { validateYouTubeUrl } from './services/validation';
import { useAuth } from './contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import PointsWidget from './components/user/PointsWidget';
import LinkAuditPage from './components/linkAudit/LinkAuditPage';
import SocialAuditSection from './components/social/SocialAuditSection';
import ScannerAnimation from './components/common/ScannerAnimation';
import VideoResultView from './components/common/result-views/VideoResultView';
import { saveAnalysis } from './services/archiveService';


const LOADING_PHASES = [
  "Инициализиране на защитена връзка с аналитичните възли...",
  "Екстракция на аудио-визуални метаданни и лингвистични структури...",
  "Семантичен анализ на наративната последователност...",
  "Крос-рефериране на извлечените твърдения с глобални източници...",
  "Деконструкция на логически заблуди и когнитивни отклонения...",
  "Идентифициране на скрити манипулативни техники и речеви модели...",
  "Изчисляване на индекси за достоверност и обективност...",
  "Формиране на финална експертна оценка и верификация...",
  "Финализиране на официалния доклад за одит..."
];

const translateMetricName = (key: string): string => {
  const translations: Record<string, string> = {
    factualAccuracy: 'Фактическа Точност',
    logicalSoundness: 'Логическа Стройност',
    emotionalBias: 'Емоционална Пристрастност',
    propagandaScore: 'Пропаганден Индекс',
    sourceReliability: 'Надеждност на Източника',
    subjectivityScore: 'Субективност',
    objectivityScore: 'Обективност',
    biasIntensity: 'Интензитет на Bias',
    narrativeConsistencyScore: 'Наративна Консистентност',
    semanticDensity: 'Семантична Плътност',
    contextualStability: 'Контекстуална Стабилност'
  };
  return translations[key] || key;
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [streamingProgress, setStreamingProgress] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [usageData, setUsageData] = useState<APIUsage | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'claims' | 'manipulation' | 'transcript' | 'report' | 'visual' | 'bodyLanguage' | 'vocal' | 'deception' | 'humor' | 'psychological' | 'cultural'>('summary');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Auth context
  const { currentUser, userProfile, logout, updateLocalBalance, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // New state for analysis mode selection - null until user selects
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode | null>(null);
  const [includeTranscription, setIncludeTranscription] = useState(true);
  const [videoMetadata, setVideoMetadata] = useState<YouTubeVideoMetadata | null>(null);
  const [costEstimates, setCostEstimates] = useState<Record<AnalysisMode, CostEstimate> | null>(null);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);

  const fullReportRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let interval: any;
    if (loading) {
      setLoadingPhase(0);
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setLoadingPhase(prev => (prev + 1) % LOADING_PHASES.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Timer for analysis duration
  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [loading]);

  // Fetch YouTube metadata when URL changes
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

        // Calculate cost estimates based on video duration
        const estimates = getAllCostEstimates(metadata.duration);
        setCostEstimates(estimates);
      } catch (e: any) {
        console.error('[Metadata Error]', e);
        setError('Грешка при зареждане на информацията за видеото. Моля, проверете URL-а.');
        setVideoMetadata(null);
        setCostEstimates(null);
      } finally {
        setFetchingMetadata(false);
      }
    };

    // Debounce the metadata fetching
    const timeoutId = setTimeout(fetchMetadata, 800);
    return () => clearTimeout(timeoutId);
  }, [youtubeUrl]);

  const handleStartAnalysis = async () => {
    const url = youtubeUrl;

    // Validate URL before proceeding
    const validation = validateYouTubeUrl(url);

    if (!validation.valid) {
      console.error('[URL Validation Error]', validation.error);
      setError('Моля, въведете валиден YouTube URL адрес.');
      return;
    }

    // Check if user is authenticated
    if (!currentUser) {
      setError('Моля, влезте в профила си за да използвате анализ функциите.');
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      return;
    }

    // Check if user has enough points
    let estimatedCost = 10; // Default base cost

    if (costEstimates && analysisMode && costEstimates[analysisMode]) {
      estimatedCost = costEstimates[analysisMode].pointsCost;
    }

    if (userProfile && userProfile.pointsBalance < estimatedCost) {
      setError(`Недостатъчно точки! Нужни са ${estimatedCost} точки. Моля, купете точки от Pricing страницата.`);
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setStreamingProgress(null);
    try {
      const modelId = 'gemini-2.5-flash';

      // Pass the mode explicitly to pick the right prompt (fallback to 'standard' if null)
      const response = await analyzeYouTubeStandard(url, videoMetadata || undefined, modelId, analysisMode || 'standard', (status) => {
        setStreamingProgress(status);
      }, includeTranscription);

      // Points are deducted SERVER-SIDE. Server returns newBalance in response.
      // Use client-side navigation instead of local state
      navigate('/analysis-result', {
        state: {
          analysis: response.analysis,
          type: 'video',
          url: youtubeUrl
        }
      });

      setUsageData(response.usage);

      // Update local balance immediately from server response (no client-side deduction)
      if (response.usage?.newBalance !== undefined) {
        updateLocalBalance(response.usage.newBalance);
      } else {
        // Fallback: refresh from Firestore
        refreshProfile();
      }

      // Fire background report synthesis (don't await - runs while user reads other tabs)
      setReportLoading(true);
      synthesizeReport(response.analysis)
        .then(report => {
          setAnalysis(prev => prev ? { ...prev, synthesizedReport: report } : prev);
        })
        .catch(err => {
          console.error('[Report Synthesis] Background error:', err);
        })
        .finally(() => {
          setReportLoading(false);
        });
    } catch (e: any) {
      console.error('[Analysis Error]', e);
      // Покажи user-friendly съобщение според типа грешка
      if (e.code === 'INSUFFICIENT_POINTS') {
        setError('Недостатъчно точки за анализ. Моля, закупете точки от Pricing страницата.');
      } else if (e.statusCode === 401 || e.code === 'API_KEY_ERROR') {
        setError('Грешка при свързване със сървъра. Моля, опитайте по-късно.');
      } else if (e.code === 'RATE_LIMIT') {
        setError('Много заявки за кратко време. Моля, изчакайте 1-2 минути и опитайте отново.');
      } else if (e.code === 'NETWORK_ERROR') {
        setError('Проблем с интернет връзката. Моля, проверете връзката си и опитайте отново.');
      } else {
        setError('Възникна неочаквана грешка при анализа. Моля, опитайте отново след малко.');
      }
    } finally {
      setLoading(false);
      setStreamingProgress(null);
    }
  };

  const handleSaveToArchive = async () => {
    if (!analysis || !currentUser) return;
    try {
      const id = await saveAnalysis(currentUser.uid, 'video', analysis.videoTitle || 'YouTube Analysis', analysis, youtubeUrl);
      setAnalysis(prev => prev ? { ...prev, id } : prev);
      // Optional: Show success toast
    } catch (err) {
      console.error('Failed to save analysis', err);
      setError('Грешка при запазване на анализа.');
    }
  };

  const resetAnalysis = () => {
    setAnalysis(null);
    setUsageData(null);
    setYoutubeUrl('');
    setError(null);
    setActiveTab('summary');
    setVideoMetadata(null);
    setCostEstimates(null);
    setAnalysisMode(null);
    setIncludeTranscription(true);
  };

  const handleSaveFullReport = async () => {
    const element = document.getElementById('full-report-article') || fullReportRef.current;
    if (!element) {
      console.error('[Export Error] Report element not ready');
      alert("Грешка при подготовка на доклада. Моля, опитайте отново.");
      return;
    }

    setIsExporting(true);
    const originalScroll = window.scrollY;
    window.scrollTo(0, 0);

    try {
      await new Promise(r => setTimeout(r, 1000));
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fffdfa',
        logging: false,
        allowTaint: true
      });

      const link = document.createElement('a');
      link.download = `Full-Audit-Dossier-${analysis?.id || 'export'}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('[PNG Export Error]', e);
      alert("Грешка при създаване на PNG файла. Моля, опитайте отново.");
    } finally {
      window.scrollTo(0, originalScroll);
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9f9] print:bg-white print:p-0">
      {/* Оригинален Hero Хедър */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-20 animate-fadeIn">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-center print:hidden">
          {/* ... keeping hero content consistent ... */}
          <div className="space-y-8 text-center lg:text-left">
            <div className="relative inline-block space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-[1.5px] w-6 bg-amber-900/60"></span>
                <span className="text-[10px] font-black text-amber-900 uppercase tracking-[0.4em] block">КЛАСИФИЦИРАН ДОСТЪП</span>
              </div>

              <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-[-0.02em] leading-[0.85] serif italic">
                <span className="block mb-2">
                  <span className="text-amber-900">О</span>дит на
                </span>
                <span className="text-slate-900 block ml-4 md:ml-8 relative">
                  <span className="text-amber-900">И</span>стината
                  <span className="absolute -bottom-2 md:-bottom-4 left-0 w-32 h-[1px] bg-slate-200"></span>
                </span>
              </h2>
            </div>
            <div className="space-y-5 max-w-lg mx-auto lg:mx-0">
              <p className="text-slate-800 text-lg md:text-2xl leading-relaxed font-semibold serif italic border-l-4 border-amber-900 pl-6 py-2 text-left bg-white/50 backdrop-blur-sm shadow-sm">
                Професионална рамка за комплексен структурен анализ на информационни активи и верификация на фактически твърдения.
              </p>
              <p className="text-slate-500 text-xs md:text-sm leading-relaxed text-left font-medium opacity-80">
                Чрез внедрената архитектура на технологията DCGE се извършва безпристрастна диагностика на източниците, осигуряваща математическа точност при дефинирането на достоверност.
              </p>
            </div>
          </div>
          <div className="hidden lg:flex justify-center items-center">
            <ScannerAnimation size={600} />
          </div>
        </div>
      </div>

      <section id="video-analysis" className="py-20 border-t border-slate-200 bg-white selection:bg-amber-900 selection:text-white">
        <div className="max-w-7xl mx-auto px-4">
          {!loading && (
            <div className="animate-fadeIn">
              {/* Хедър на секцията */}
              <div className="text-center space-y-4 mb-12">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <span className="h-[1px] w-8 bg-amber-900/30"></span>
                  <span className="text-[10px] font-black text-amber-900 uppercase tracking-[0.4em]">YouTube Видео Одит</span>
                  <span className="h-[1px] w-8 bg-amber-900/30"></span>
                </div>
                <h3 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight italic serif">
                  Анализирай <span className="text-amber-900">видео</span> поток
                </h3>
              </div>

              {/* Input Section */}
              <div className="max-w-3xl mx-auto editorial-card p-2 mb-12 flex flex-col md:flex-row gap-2">
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  placeholder="Поставете YouTube линк..."
                  className="flex-1 bg-transparent px-6 py-4 text-slate-900 font-bold focus:outline-none placeholder:text-slate-300"
                />
                {fetchingMetadata && (
                  <div className="flex items-center bg-slate-50 border-x border-slate-100 px-4">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
                  </div>
                )}
                <button
                  onClick={() => handleStartAnalysis()}
                  disabled={loading || !youtubeUrl.trim() || !analysisMode}
                  className="px-12 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all bg-amber-900 text-white hover:bg-black active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {loading ? '...' : 'Одит'}
                </button>
              </div>

              {/* Metadata & Selectors */}
              <div className="max-w-3xl mx-auto space-y-6">
                {videoMetadata && !fetchingMetadata && (
                  <div className="bg-white/50 backdrop-blur-sm p-4 rounded-sm border border-slate-200 flex items-center gap-4 animate-fadeIn">
                    <span className="text-2xl">📹</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-slate-900 truncate">{videoMetadata.title}</h3>
                      <div className="flex gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        <span>{videoMetadata.author}</span>
                        <span>{videoMetadata.durationFormatted}</span>
                      </div>
                    </div>
                  </div>
                )}

                {costEstimates && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div
                        onClick={() => !loading && setAnalysisMode('standard')}
                        className={`cursor-pointer p-6 rounded-sm border-2 transition-all text-center space-y-2 ${analysisMode === 'standard' ? 'border-amber-900 bg-amber-50/50' : 'border-slate-100 bg-white hover:border-amber-900/30'}`}
                      >
                        <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">Стандартен Одит</p>
                        <p className="text-2xl font-black text-slate-900">{costEstimates.standard.pointsCost} <span className="text-xs uppercase opacity-40">точки</span></p>
                      </div>

                      <div
                        onClick={() => !loading && setAnalysisMode('deep')}
                        className={`cursor-pointer p-6 rounded-sm border-2 transition-all text-center space-y-2 ${analysisMode === 'deep' ? 'border-slate-900 bg-slate-50' : 'border-slate-100 bg-white hover:border-slate-900/30'}`}
                      >
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Задълбочен Одит</p>
                        <p className="text-2xl font-black text-slate-900">{costEstimates.deep.pointsCost} <span className="text-xs uppercase opacity-40">точки</span></p>
                      </div>
                    </div>

                    {analysisMode === 'deep' && (
                      <button
                        type="button"
                        onClick={() => !loading && setIncludeTranscription(v => !v)}
                        className="group flex items-center gap-3 w-full py-2.5 px-3 rounded-sm border border-slate-200/80 bg-white/60 backdrop-blur-sm hover:bg-slate-50/70 hover:border-slate-300/80 transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-amber-900/20 focus:border-amber-900/30"
                      >
                        <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-all duration-300 ease-out ${includeTranscription ? 'border-amber-900/30 bg-amber-100/80' : 'border-slate-200 bg-slate-100 group-hover:bg-slate-200/80'}`}>
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm ring-0 transition-all duration-300 ease-out translate-y-0.5 ${
                              includeTranscription
                                ? 'translate-x-5 bg-amber-900 border border-amber-900'
                                : 'translate-x-0.5 bg-white border border-slate-200'
                            }`}
                          />
                        </span>
                        <span className="flex-1 text-left text-[10px] font-semibold text-slate-700 uppercase tracking-wide">
                          Транскрипция <span className="font-normal normal-case text-slate-500">(изключете за да намалите драстично времето за анализ, особенно при по-дълги диалози и подкасти )</span>
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-widest transition-colors duration-300 ${includeTranscription ? 'text-amber-900' : 'text-slate-400'}`}>
                          {includeTranscription ? 'Вкл.' : 'Изкл.'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center px-8">
              <div className="text-center space-y-8 max-w-lg w-full">
                <div className="w-full h-1 bg-slate-100 relative overflow-hidden"><div className="absolute inset-0 bg-slate-900 animate-[loading_2s_infinite]"></div></div>
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-[0.3em] serif italic animate-pulse">ОДИТ НА ИСТИННОСТТА В ПРОЦЕС</h2>
                  <div className="font-mono text-3xl md:text-4xl font-black text-slate-800 tracking-[0.15em]">
                    {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
                  </div>
                  <p className="text-[10px] md:text-[11px] font-black text-amber-900 uppercase tracking-widest leading-relaxed h-12">
                    {streamingProgress || LOADING_PHASES[loadingPhase]}
                  </p>
                </div>
              </div>
            </div>
          )}

          <style>{`
          @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
          .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
          .animate-shake { animation: shake 0.4s ease-in-out; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
        `}</style>
        </div>
      </section>

      <LinkAuditPage />
      <SocialAuditSection />
    </div>
  );
};

export default App;
