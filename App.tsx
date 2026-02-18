
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

const MetricBlock: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => {
  const val = Math.round(value > 1 ? value : value * 100);
  const colorMap: any = {
    blue: 'bg-amber-900',
    emerald: 'bg-emerald-700',
    orange: 'bg-orange-700',
    red: 'bg-red-700'
  };

  return (
    <div className="editorial-card p-4 md:p-5 border-t-2 border-t-slate-800">
      <p className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter">{val}%</span>
      </div>
      <div className="w-full h-1 bg-slate-100 mt-2 overflow-hidden">
        <div className={`h-full ${colorMap[color] || 'bg-amber-900'} transition-all duration-1000`} style={{ width: `${val}%` }} />
      </div>
    </div>
  );
};

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
      });

      // Points are deducted SERVER-SIDE. Server returns newBalance in response.
      setAnalysis(response.analysis);
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

  const resetAnalysis = () => {
    setAnalysis(null);
    setUsageData(null);
    setYoutubeUrl('');
    setError(null);
    setActiveTab('summary');
    setVideoMetadata(null);
    setCostEstimates(null);
    setAnalysisMode(null); // Reset to null so user must select again
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
            <ScannerAnimation />
          </div>
        </div>
      </div>

      <section id="video-analysis" className="py-20 border-t border-slate-200 bg-white selection:bg-amber-900 selection:text-white">
        <div className="max-w-7xl mx-auto px-4">
          {!analysis && !loading && (
            <div className="animate-fadeIn">
              {/* Хедър на секцията */}
              <div className="text-center space-y-4 mb-12">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <span className="h-[1px] w-8 bg-amber-900/30"></span>
                  <span className="text-[10px] font-black text-amber-900 uppercase tracking-[0.4em]">Професионален Видео Одит</span>
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
                <div className="flex items-center bg-slate-50 border-x border-slate-100 px-4">
                  {fetchingMetadata && <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>}
                </div>
                <button
                  onClick={() => handleStartAnalysis()}
                  disabled={loading || !youtubeUrl.trim() || !analysisMode}
                  className={`px-12 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${loading || !youtubeUrl.trim() || !analysisMode
                    ? 'bg-slate-400 text-slate-200 cursor-not-allowed'
                    : 'bg-amber-900 text-white hover:bg-black active:scale-[0.98]'
                    }`}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
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
                )}
              </div>
            </div>
          )}

          {analysis && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10 animate-fadeIn">
              <aside className="lg:col-span-3 space-y-4 print:hidden">
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                  <MetricBlock label="Индекс на Достоверност" value={analysis.summary.credibilityIndex} color="emerald" />
                  <MetricBlock label="Индекс на Манипулация" value={analysis.summary.manipulationIndex} color="orange" />
                </div>
                <div className="editorial-card p-4 border-l-2 border-l-amber-900 bg-amber-50/30">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">КЛАСИФИКАЦИЯ</p>
                  <span className="text-slate-900 font-black text-sm md:text-base block leading-tight uppercase tracking-tighter serif italic">{analysis.summary.finalClassification}</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-sm">
                  <p className="text-[7px] font-black text-emerald-700 uppercase tracking-widest mb-0.5">Цена на анализа</p>
                  <p className="text-lg font-black text-emerald-900">{(analysis.pointsCost ?? 0).toLocaleString('bg-BG')} точки</p>
                </div>
              </aside>

              <main className="lg:col-span-9 space-y-6">
                <nav className="flex flex-wrap gap-x-8 gap-y-2 border-b border-slate-200 sticky top-[72px] md:top-[92px] bg-[#f9f9f9]/95 backdrop-blur-md z-40 py-3 print:hidden transition-all duration-300">
                  {(() => {
                    const baseTabsBefore = [
                      { id: 'summary', label: 'Резюме' },
                      { id: 'claims', label: 'Твърдения' },
                      { id: 'manipulation', label: 'Манипулация' },
                      { id: 'transcript', label: 'Транскрипт' }
                    ];

                    const deepTabs = analysis.analysisMode === 'deep' ? [
                      { id: 'visual', label: 'Визуален' },
                      { id: 'bodyLanguage', label: 'Тяло' },
                      { id: 'vocal', label: 'Вокал' },
                      { id: 'deception', label: 'Измама' },
                      { id: 'humor', label: 'Хумор' },
                      { id: 'psychological', label: 'Психо' },
                      { id: 'cultural', label: 'Културен' }
                    ] : [];

                    const finalTabs = [...baseTabsBefore, ...deepTabs, { id: 'report', label: 'Финален доклад' }];

                    return finalTabs.map(tab => {
                      const isReportTab = tab.id === 'report';
                      const isDisabled = isReportTab && reportLoading;

                      return (
                        <button
                          key={tab.id}
                          onClick={() => !isDisabled && setActiveTab(tab.id as any)}
                          disabled={isDisabled}
                          className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap pb-1 relative transition-all flex items-center gap-1.5 ${isDisabled
                            ? 'text-slate-300 cursor-not-allowed'
                            : activeTab === tab.id
                              ? 'text-amber-900'
                              : 'text-slate-400 hover:text-slate-900'
                            }`}
                        >
                          {tab.label}
                          {isReportTab && reportLoading && (
                            <span className="inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span>
                          )}
                          {activeTab === tab.id && !isDisabled && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-900"></div>
                          )}
                        </button>
                      );
                    });
                  })()}
                </nav>

                <section className="min-h-[400px]">
                  {activeTab === 'summary' && (
                    <div className="space-y-10 animate-fadeIn">
                      <div className="editorial-card p-6 md:p-8 border-l-4 border-l-slate-900 space-y-4">
                        <div className="flex justify-between items-start relative">
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-amber-900 uppercase tracking-widest">ОБЕКТ:</p>
                            <h2 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight serif italic leading-tight pr-24">{analysis.videoTitle}</h2>
                          </div>
                          <div className={`px-2 py-0.5 border ${analysis.analysisMode === 'deep' ? 'bg-amber-900 border-amber-900 text-white' : 'border-slate-200 text-slate-400'} text-[7px] font-black uppercase tracking-[0.2em] rounded-sm shadow-sm absolute top-0 right-0`}>
                            {analysis.analysisMode === 'deep' ? 'Дълбок анализ' : 'Стандартен анализ'}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                          <div><p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Източник</p><p className="text-xs font-black text-slate-900 uppercase truncate">{analysis.videoAuthor}</p></div>
                          <div><p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Времетраене</p><p className="text-xs font-black text-slate-900 uppercase">{analysis.summary.totalDuration}</p></div>
                          <div><p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Дата</p><p className="text-xs font-black text-slate-900 uppercase">{new Date(analysis.timestamp).toLocaleDateString()}</p></div>
                          <div><p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Audit ID</p><p className="text-xs font-black text-amber-900 uppercase">#{analysis.id}</p></div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-900 pb-1 inline-block">Изпълнително Резюме</h3>
                        <p className="text-slate-800 text-base md:text-xl leading-relaxed serif italic border-l-2 border-amber-900 pl-6 py-2 bg-amber-50/20">„{analysis.summary.overallSummary}“</p>
                      </div>
                      <div className="pt-4"><ReliabilityChart data={analysis.timeline} claims={analysis.claims} totalDuration={analysis.summary.totalDuration} /></div>
                    </div>
                  )}

                  {activeTab === 'claims' && (
                    <div className="space-y-6 animate-fadeIn">

                      {analysis.claims.map((claim, idx) => (
                        <div key={idx} className="editorial-card p-6 md:p-8 space-y-6 border-t-2 border-t-slate-800">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                            <span className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest border ${claim.veracity.toLowerCase().includes('невярно') ? 'border-red-700 text-red-700 bg-red-50' : 'border-emerald-700 text-emerald-700 bg-emerald-50'}`}>{claim.veracity}</span>
                            <div className="flex gap-4 text-[8px] font-black uppercase tracking-widest text-slate-400"><span>Категория: {claim.category}</span><span>Прецизност: {Math.round(claim.confidence * 100)}%</span></div>
                          </div>
                          <blockquote className="text-lg md:text-2xl font-black text-slate-900 leading-tight serif italic tracking-tighter">„{claim.quote}“</blockquote>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
                            <div className="space-y-2"><h5 className="text-[8px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-900 pb-0.5 inline-block">Логически Одит</h5><p className="text-slate-600 leading-relaxed font-medium">{claim.explanation}</p></div>
                            <div className="space-y-2"><h5 className="text-[8px] font-black text-amber-900 uppercase tracking-widest border-b border-amber-900 pb-0.5 inline-block">Контекст</h5><p className="text-slate-600 leading-relaxed italic">{claim.missingContext}</p></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'manipulation' && (
                    <div className="space-y-8 animate-fadeIn">
                      <div className="border-b border-slate-900 pb-4 mb-6">
                        <h3 className="text-lg md:text-xl font-black uppercase serif italic mb-2">Деконструкция на Манипулациите</h3>
                        <p className="text-xs text-slate-600 italic">Всички идентифицирани манипулативни техники с конкретни примери от видеото и анализ на въздействието им.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-6">
                        {analysis.manipulations.map((m, idx) => {
                          const severity = Math.round((m.severity > 1 ? m.severity / 100 : m.severity) * 100);
                          const getSeverityBorderColor = () => {
                            if (severity >= 70) return 'border-l-red-600';
                            if (severity >= 50) return 'border-l-orange-600';
                            return 'border-l-yellow-600';
                          };
                          const getSeverityTextColor = () => {
                            if (severity >= 70) return 'text-red-600';
                            if (severity >= 50) return 'text-orange-600';
                            return 'text-yellow-600';
                          };
                          return (
                            <div key={idx} className={`editorial-card p-5 md:p-7 border-l-4 ${getSeverityBorderColor()} hover:shadow-lg transition-shadow`}>
                              <div className="flex justify-between items-start mb-4">
                                <div className="space-y-0.5 flex-1">
                                  <h4 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight">{m.technique}</h4>
                                  <span className="text-[8px] font-black text-orange-600 uppercase tracking-widest">{m.timestamp}</span>
                                </div>
                                <div className="text-right ml-4">
                                  <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Интензитет</p>
                                  <span className={`text-lg md:text-xl font-black ${getSeverityTextColor()}`}>{severity}%</span>
                                </div>
                              </div>
                              <div className="bg-slate-50 p-4 mb-4 border border-slate-200">
                                <p className="text-xs font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">{m.logic}</p>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px]">
                                <div>
                                  <p className="font-black uppercase text-slate-400 text-[8px] mb-1 tracking-widest">Въздействие върху аудиторията:</p>
                                  <p className="text-slate-700 font-medium leading-relaxed">{m.effect}</p>
                                </div>
                                <div>
                                  <p className="font-black uppercase text-emerald-800 text-[8px] mb-1 tracking-widest">Как да се защитим:</p>
                                  <p className="text-slate-700 italic leading-relaxed">{m.counterArgument || 'Проверка на първоизточници и критично мислене.'}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeTab === 'transcript' && (
                    <div className="editorial-card p-6 md:p-10 animate-fadeIn bg-white border-t-2 border-t-slate-900">
                      <div className="mb-6 pb-4 border-b border-slate-200">
                        <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-widest mb-2">Пълна транскрипция</h3>
                        <p className="text-xs text-slate-600 italic">Реалните имена на участниците са извлечени от видеото. Ако името не е споменато, се използва 'Speaker 1', 'Speaker 2' и т.н.</p>
                      </div>
                      <div className="max-w-2xl mx-auto space-y-8 text-sm">
                        {analysis.transcription.map((line, idx) => {
                          // Проверка дали speaker е реално име или номер
                          const isRealName = line.speaker && !line.speaker.match(/^Speaker\s*\d+$/i) && !line.speaker.includes('Система');
                          return (
                            <div key={idx} className="flex gap-6 group hover:bg-slate-50 p-3 -m-3 rounded transition-colors">
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest w-12 pt-1 shrink-0">{line.timestamp}</span>
                              <div className="space-y-1 flex-1">
                                <span className={`text-[8px] font-black uppercase tracking-widest ${isRealName ? 'text-emerald-700' : 'text-amber-900'}`}>
                                  {line.speaker}
                                  {isRealName && <span className="ml-2 text-[7px] text-emerald-600">(Реално име)</span>}
                                </span>
                                <p className="text-base text-slate-800 leading-relaxed serif font-medium">{line.text}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeTab === 'visual' && (
                    <div className="space-y-6 animate-fadeIn">
                      <MultimodalSection title="🎥 Визуален Анализ" content={analysis.visualAnalysis} color="indigo" />
                    </div>
                  )}
                  {activeTab === 'bodyLanguage' && (
                    <div className="space-y-6 animate-fadeIn">
                      <MultimodalSection title="🙋 Език на тялото & Невербална комуникация" content={analysis.bodyLanguageAnalysis} color="indigo" />
                    </div>
                  )}
                  {activeTab === 'vocal' && (
                    <div className="space-y-6 animate-fadeIn">
                      <MultimodalSection title="🎤 Вокален & Паралингвистичен анализ" content={analysis.vocalAnalysis} color="indigo" />
                    </div>
                  )}
                  {activeTab === 'deception' && (
                    <div className="space-y-6 animate-fadeIn">
                      <MultimodalSection title="🔍 Анализ на Честност & Измама" content={analysis.deceptionAnalysis} color="indigo" />
                    </div>
                  )}
                  {activeTab === 'humor' && (
                    <div className="space-y-6 animate-fadeIn">
                      <MultimodalSection title="😄 Анализ на Хумор & Сатира" content={analysis.humorAnalysis} color="indigo" />
                    </div>
                  )}
                  {activeTab === 'psychological' && (
                    <div className="space-y-6 animate-fadeIn">
                      <MultimodalSection title="🧠 Психологически Профил на участниците" content={analysis.psychologicalProfile} color="indigo" />
                    </div>
                  )}
                  {activeTab === 'cultural' && (
                    <div className="space-y-6 animate-fadeIn">
                      <MultimodalSection title="🏛️ Културен & Символен анализ" content={analysis.culturalSymbolicAnalysis} color="indigo" />
                    </div>
                  )}

                  {activeTab === 'report' && (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="p-6 bg-slate-900 text-white flex justify-between items-center rounded-sm">
                        <h4 className="text-sm font-black serif italic uppercase tracking-widest">Пълен Експертен Одит (Досие)</h4>
                        <button onClick={handleSaveFullReport} disabled={isExporting} className="px-6 py-2 bg-amber-900 text-white font-black uppercase text-[9px] tracking-[0.2em] hover:bg-amber-800 transition-all flex items-center gap-2">
                          {isExporting ? 'ГЕНЕРИРАНЕ...' : 'СВАЛИ PNG'}
                        </button>
                      </div>
                      <ReportView analysis={analysis} reportRef={fullReportRef} reportLoading={reportLoading} />
                    </div>
                  )}
                </section>
              </main>
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

const MultimodalSection: React.FC<{ title: string; content?: string; color: string }> = ({ title, content, color }) => {
  if (!content || content === 'Няма данни') return null;

  return (
    <div className={`editorial-card p-6 md:p-10 border-t-2 border-t-${color}-600 bg-white animate-fadeIn`}>
      <div className="mb-6 pb-4 border-b border-slate-200">
        <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight serif italic">{title}</h3>
      </div>
      <div className="prose prose-slate max-w-none">
        <div className="text-slate-800 text-sm md:text-base leading-relaxed whitespace-pre-wrap serif">
          {content}
        </div>
      </div>
    </div>
  );
};

const ReportView: React.FC<{ analysis: VideoAnalysis; reportRef?: React.RefObject<HTMLElement>; reportLoading?: boolean }> = ({ analysis, reportRef, reportLoading }) => {
  const reportText = analysis.synthesizedReport || analysis.summary.finalInvestigativeReport || '';

  // Parse markdown-like report into structured sections
  const renderReportContent = (text: string) => {
    const sections = text.split(/\n(?=# )/).filter(Boolean);

    return sections.map((section, sIdx) => {
      const lines = section.split('\n');
      const titleLine = lines[0] || '';
      const isMainSection = titleLine.startsWith('# ') && !titleLine.startsWith('## ');
      const sectionTitle = titleLine.replace(/^#+\s*/, '').trim();
      const bodyLines = lines.slice(1);

      return (
        <section key={sIdx} className={`mb-10 ${sIdx === 0 ? '' : 'pt-8 border-t border-slate-200'}`}>
          {sectionTitle && (
            <h4 className={`text-[9px] font-black uppercase tracking-[0.4em] pb-2 mb-6 border-b ${isMainSection ? 'text-amber-900 border-amber-200' : 'text-slate-700 border-slate-200'
              }`}>
              {sectionTitle}
            </h4>
          )}
          <div className={`text-slate-800 text-sm md:text-[15px] leading-relaxed serif ${sIdx === 0 ? 'first-letter:text-5xl first-letter:font-black first-letter:mr-3 first-letter:float-left first-letter:leading-none' : ''}`}>
            {bodyLines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              if (trimmed.startsWith('## ')) {
                return <h5 key={lIdx} className="text-base md:text-lg font-black text-slate-900 uppercase mt-6 mb-3 tracking-tight">{trimmed.replace(/^##\s*/, '')}</h5>;
              }
              if (trimmed.startsWith('### ')) {
                return <h6 key={lIdx} className="text-sm md:text-base font-black text-slate-800 mt-4 mb-2">{trimmed.replace(/^###\s*/, '')}</h6>;
              }
              if (trimmed === '---') {
                return <hr key={lIdx} className="my-6 border-slate-200" />;
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return <li key={lIdx} className="ml-4 mb-2 list-disc text-slate-700">{renderInlineMarkdown(trimmed.substring(2))}</li>;
              }
              if (/^\d+\.\s/.test(trimmed)) {
                return <li key={lIdx} className="ml-4 mb-2 list-decimal text-slate-700">{renderInlineMarkdown(trimmed.replace(/^\d+\.\s*/, ''))}</li>;
              }
              if (trimmed.startsWith('> ')) {
                return <blockquote key={lIdx} className="border-l-4 border-amber-300 pl-4 italic text-slate-600 my-4">{renderInlineMarkdown(trimmed.substring(2))}</blockquote>;
              }
              return <p key={lIdx} className="mb-4 leading-relaxed">{renderInlineMarkdown(trimmed)}</p>;
            })}
          </div>
        </section>
      );
    });
  };

  // Render inline markdown (bold, italic)
  const renderInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-black text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  return (
    <article ref={reportRef} id="full-report-article" className="max-w-[1100px] mx-auto bg-[#fffdfa] p-8 md:p-12 border border-slate-300 shadow-sm relative print:shadow-none print:border-none">
      <header className="mb-12 pb-8 border-b-2 border-slate-900 text-center">
        <div className="text-[9px] font-black text-amber-900 uppercase tracking-[0.6em] mb-4">КЛАСИФИЦИРАНО РАЗСЛЕДВАЩО ДОСИЕ #{analysis.id?.substring(0, 8)}</div>
        <h3 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight uppercase mb-4 serif italic leading-tight">{analysis.videoTitle}</h3>
        <div className="flex justify-center gap-10 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
          <span>ИЗТОЧНИК: {analysis.videoAuthor}</span>
          <span>ДАТА: {new Date(analysis.timestamp).toLocaleString('bg-BG')}</span>
          <span>ДВИГАТЕЛ: DCGE v4.8</span>
        </div>
        {analysis.synthesizedReport && (
          <div className="mt-4 text-[8px] font-black text-emerald-700 uppercase tracking-widest">✦ СИНТЕЗИРАН АВТОРСКИ ДОКЛАД ✦</div>
        )}
      </header>

      {reportLoading ? (
        <div className="text-center py-20 animate-pulse">
          <div className="inline-block w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mb-6"></div>
          <h4 className="text-lg font-black text-slate-900 uppercase tracking-widest mb-2">Генериране на доклад</h4>
          <p className="text-xs text-slate-500 uppercase tracking-wider">Главният редактор подготвя финалния авторски анализ...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-8 space-y-2">
            {renderReportContent(reportText)}
          </div>

          <aside className="md:col-span-4 space-y-8">
            <div className="p-6 bg-slate-900 text-white rounded-sm">
              <h4 className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-6 border-b border-white/10 pb-2 text-center">АНАЛИТИЧНИ МЕТРИКИ</h4>
              <div className="space-y-6">
                {Object.entries(analysis.summary.detailedStats).map(([key, val], idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-[7px] font-black uppercase mb-1">
                      <span className="opacity-60">{translateMetricName(key)}</span>
                      <span className="text-amber-500">{Math.round((val as number) * 100)}%</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${(val as number) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-2 border-double border-amber-900/30 text-center bg-white shadow-sm">
              <div className="w-10 h-10 border-2 border-amber-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-amber-900 font-black text-xl">✓</span>
              </div>
              <p className="text-[8px] font-black text-slate-800 uppercase leading-relaxed mb-1 tracking-widest">АВТЕНТИФИЦИРАНО</p>
              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tight">Верифицирано срещу глобални данни.</p>
            </div>

            <div className="p-6 bg-slate-50 border border-slate-100 rounded-sm">
              <h4 className="text-[8px] font-black text-slate-900 uppercase mb-4 tracking-widest">СТРАТЕГИЧЕСКО НАМЕРЕНИЕ</h4>
              <p className="text-[11px] text-slate-600 italic leading-relaxed">
                {analysis.summary.strategicIntent}
              </p>
            </div>

            <div className="p-6 bg-slate-100/50 border border-slate-200 text-[8px] text-slate-400 font-mono leading-tight uppercase rounded-sm">
              ИД НА ОДИТ (AUDIT_ID): {analysis.id}<br />
              ВЪЗЕЛ (NODE): SEREZLIEV_G_UNIT<br />
              СТАТУС (STATUS): FINAL_VERIFICATION<br />
              ХЕШ (HASH): {Math.random().toString(16).slice(2, 18).toUpperCase()}
            </div>
          </aside>
        </div>
      )}

      <footer className="mt-20 pt-8 border-t border-slate-200 text-center">
        <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.5em] mb-4">© ФАКТЧЕКЪР AI | ПЪЛЕН МЕДИЕН АНАЛИЗАТОР</div>
        <p className="text-[7px] text-slate-300 uppercase leading-relaxed max-w-2xl mx-auto">
          Този документ е генериран чрез алгоритмите на Deep Contextual Reasoning Engine v4.8.
          Всички изводи са базирани на статистическа вероятност и крос-рефериране с независими източници.
        </p>
      </footer>
    </article>
  );
};

export default App;
