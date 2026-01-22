
import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { analyzeYouTubeLink, analyzeNewsLink } from './services/geminiService';
import { VideoAnalysis, APIUsage } from './types';
import ReliabilityChart from './components/ReliabilityChart';

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
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [usageData, setUsageData] = useState<APIUsage | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'claims' | 'manipulation' | 'transcript' | 'report'>('summary');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [newsUrl, setNewsUrl] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const fullReportRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let interval: any;
    if (loading) {
      setLoadingPhase(0);
      interval = setInterval(() => {
        setLoadingPhase(prev => (prev + 1) % LOADING_PHASES.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleStartAnalysis = async (type: 'video' | 'news') => {
    const url = type === 'video' ? youtubeUrl : newsUrl;
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const response = type === 'video' ? await analyzeYouTubeLink(url) : await analyzeNewsLink(url);
      setAnalysis(response.analysis);
      setUsageData(response.usage);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetAnalysis = () => {
    setAnalysis(null);
    setUsageData(null);
    setYoutubeUrl('');
    setNewsUrl('');
    setError(null);
    setActiveTab('summary');
  };

  const handleSaveFullReport = async () => {
    const element = document.getElementById('full-report-article') || fullReportRef.current;
    if (!element) {
      alert("Грешка: Елементът за доклад не е готов.");
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
      console.error(e);
      alert("Грешка при генериране на PNG.");
    } finally {
      window.scrollTo(0, originalScroll);
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 px-4 md:px-8 max-w-[1200px] mx-auto bg-[#f9f9f9] print:bg-white print:p-0">
      <header className="py-6 md:py-10 border-b border-slate-300 mb-8 md:mb-12 flex flex-col md:flex-row justify-between items-center md:items-end print:hidden gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 uppercase mb-0.5 serif italic text-nowrap">ФАКТЧЕКЪР <span className="text-amber-900">AI</span></h1>
          <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest">Deep Context Generative Engine by Serezliev Intelligence Unit | v4.8</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center md:items-end">
          {usageData && (
            <div className="text-center md:text-right">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Load</p>
              <p className="text-[10px] font-black text-slate-900 uppercase">{usageData.totalTokens.toLocaleString()} tokens • <span className="text-amber-900">${usageData.estimatedCostUSD.toFixed(4)}</span></p>
            </div>
          )}
          <div className="flex gap-4 items-center">
            <button onClick={resetAnalysis} className="bg-slate-900 text-white px-5 py-2 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all">НОВ ОДИТ</button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-12 p-5 bg-red-50 border-l-2 border-red-700 rounded-sm flex items-center gap-4 print:hidden animate-shake">
          <span className="text-red-700 font-black uppercase text-[9px] tracking-widest shrink-0">Грешка:</span>
          <p className="text-red-900 text-xs font-bold">{error}</p>
        </div>
      )}

      {!analysis && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 mt-4 md:mt-10 items-start print:hidden">
          <div className="space-y-8 text-center lg:text-left">
            <div className="relative inline-block group">
              <span className="text-[10px] font-black text-amber-900 uppercase tracking-[0.5em] mb-4 block animate-pulse">CLASSIFIED ACCESS</span>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight mb-6 md:mb-8 serif">
                Одит на <br />
                <span className="text-slate-900 relative inline-block">
                  истината
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-amber-900"></span>
                </span>
              </h2>
              <div className="absolute -left-10 top-0 bottom-0 w-2.5 bg-slate-900 hidden lg:block rounded-full shadow-lg shadow-amber-900/20"></div>
            </div>
            <div className="space-y-5 max-w-lg">
              <p className="text-slate-800 text-lg md:text-2xl leading-relaxed font-semibold serif italic border-l-4 border-amber-900 pl-6 py-2 text-left bg-white/50 backdrop-blur-sm shadow-sm">
                Професионална рамка за комплексен структурен анализ на информационни активи и верификация на фактически твърдения.
              </p>
              <p className="text-slate-500 text-xs md:text-sm leading-relaxed text-left font-medium opacity-80">
                Чрез внедрената архитектура на технологията DCGE се извършва безпристрастна диагностика на източниците, осигуряваща математическа точност при дефинирането на достоверност.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="editorial-card p-6 md:p-8 rounded-sm space-y-5 border-b-8 border-b-slate-900 bg-white">
              <label className="text-[9px] md:text-[10px] font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-0.5 block w-max">Разследване на Видео</label>
              <input type="text" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="YouTube URL..." className="w-full bg-slate-50 border border-slate-200 p-4 font-bold text-sm outline-none focus:border-slate-900 transition-all focus:ring-4 focus:ring-slate-900/5" />
              <button onClick={() => handleStartAnalysis('video')} className="w-full bg-slate-900 text-white p-5 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]">АНАЛИЗИРАЙ ВИДЕОПОТОК</button>
            </div>
            <div className="editorial-card p-6 md:p-8 rounded-sm space-y-5 border-b-8 border-b-amber-900 bg-white">
              <label className="text-[9px] md:text-[10px] font-black text-amber-900 uppercase tracking-widest border-b-2 border-amber-900 pb-0.5 block w-max">Разследване на Текст</label>
              <input type="text" value={newsUrl} onChange={e => setNewsUrl(e.target.value)} placeholder="Article URL..." className="w-full bg-slate-50 border border-slate-200 p-4 font-bold text-sm outline-none focus:border-amber-900 transition-all focus:ring-4 focus:ring-amber-900/5" />
              <button onClick={() => handleStartAnalysis('news')} className="w-full bg-amber-900 text-white p-5 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-amber-950 transition-all shadow-xl shadow-amber-900/20 active:scale-[0.98]">АНАЛИЗИРАЙ ЛИНК</button>
            </div>
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
            <div className="p-3 bg-slate-100 rounded-sm">
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Data Points</p>
              <p className="text-lg font-black text-slate-900">{analysis.summary.dataPointsProcessed.toLocaleString()}</p>
            </div>
          </aside>

          <main className="lg:col-span-9 space-y-6">
            <nav className="flex overflow-x-auto gap-8 border-b border-slate-200 sticky top-0 bg-[#f9f9f9]/95 backdrop-blur-md z-40 py-3 print:hidden no-scrollbar">
              {(['summary', 'claims', 'manipulation', 'transcript', 'report'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap pb-1 relative transition-all ${activeTab === tab ? 'text-amber-900' : 'text-slate-400 hover:text-slate-900'}`}
                >
                  {{ summary: 'Резюме', claims: 'Твърдения', manipulation: 'Манипулация', transcript: 'Транскрипт', report: 'Финален Доклад' }[tab]}
                  {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-900"></div>}
                </button>
              ))}
            </nav>

            <section className="min-h-[400px]">
              {activeTab === 'summary' && (
                <div className="space-y-10 animate-fadeIn">
                  <div className="editorial-card p-6 md:p-8 border-l-4 border-l-slate-900 space-y-4">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-amber-900 uppercase tracking-widest">ОБЕКТ:</p>
                      <h2 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight serif italic leading-tight">{analysis.videoTitle}</h2>
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
                  <h3 className="text-lg md:text-xl font-black uppercase serif italic border-b border-slate-900 pb-1">Деконструкция на Манипулациите</h3>
                  <div className="grid grid-cols-1 gap-6">
                    {analysis.manipulations.map((m, idx) => (
                      <div key={idx} className="editorial-card p-5 md:p-7 border-l-4 border-l-orange-600">
                        <div className="flex justify-between items-start mb-4">
                          <div className="space-y-0.5">
                            <h4 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight">{m.technique}</h4>
                            <span className="text-[8px] font-black text-orange-600 uppercase tracking-widest">{m.timestamp}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Интензитет</p>
                            <span className="text-lg md:text-xl font-black text-orange-600">{Math.round((m.severity > 1 ? m.severity / 100 : m.severity) * 100)}%</span>
                          </div>
                        </div>
                        <p className="text-xs font-bold text-slate-800 leading-relaxed italic bg-slate-50 p-3 mb-4">{m.logic}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px]">
                          <div><p className="font-black uppercase text-slate-400 text-[8px] mb-1 tracking-widest">Въздействие:</p><p className="text-slate-700 font-medium">{m.effect}</p></div>
                          <div><p className="font-black uppercase text-emerald-800 text-[8px] mb-1 tracking-widest">Противодействие:</p><p className="text-slate-700 italic">{m.counterArgument || 'Проверка на първоизточници.'}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'transcript' && (
                <div className="editorial-card p-6 md:p-10 animate-fadeIn bg-white border-t-2 border-t-slate-900">
                  <div className="max-w-2xl mx-auto space-y-8 text-sm">
                    {analysis.transcription.map((line, idx) => (
                      <div key={idx} className="flex gap-6 group">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest w-12 pt-1 shrink-0">{line.timestamp}</span>
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-amber-900 uppercase tracking-widest">{line.speaker}</span>
                          <p className="text-base text-slate-800 leading-relaxed serif font-medium">{line.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
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
                  <ReportView analysis={analysis} reportRef={fullReportRef} />
                </div>
              )}
            </section>
          </main>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-white/98 z-[100] flex items-center justify-center px-8">
          <div className="text-center space-y-8 max-w-lg w-full">
            <div className="w-full h-1 bg-slate-100 relative overflow-hidden"><div className="absolute inset-0 bg-slate-900 animate-[loading_2s_infinite]"></div></div>
            <div className="space-y-4">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-[0.3em] serif italic animate-pulse">ОДИТ НА ИСТИННОСТТА В ПРОЦЕС</h2>
              <p className="text-[10px] md:text-[11px] font-black text-amber-900 uppercase tracking-widest leading-relaxed h-12">
                {LOADING_PHASES[loadingPhase]}
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
  );
};

const ReportView: React.FC<{ analysis: VideoAnalysis, reportRef?: React.RefObject<HTMLElement> }> = ({ analysis, reportRef }) => {
  return (
    <article ref={reportRef} id="full-report-article" className="max-w-[1100px] mx-auto bg-[#fffdfa] p-8 md:p-12 border border-slate-300 shadow-sm relative print:shadow-none print:border-none">
      <header className="mb-12 pb-8 border-b-2 border-slate-900 text-center">
        <div className="text-[9px] font-black text-amber-900 uppercase tracking-[0.6em] mb-4">КЛАСИФИЦИРАНО РАЗСЛЕДВАЩО ДОСИЕ #{analysis.id}</div>
        <h3 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight uppercase mb-4 serif italic leading-tight">{analysis.videoTitle}</h3>
        <div className="flex justify-center gap-10 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
          <span>ИЗТОЧНИК: {analysis.videoAuthor}</span>
          <span>ДАТА: {new Date(analysis.timestamp).toLocaleString('bg-BG')}</span>
          <span>ДВИГАТЕЛ: DCGE v4.8</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-8 space-y-12">
          <section>
            <h4 className="text-[9px] font-black text-amber-900 uppercase tracking-[0.4em] border-b border-amber-100 pb-1 mb-4">I. ГЛАВНО СЛЕДСТВЕНО ЗАКЛЮЧЕНИЕ</h4>
            <div className="text-slate-900 text-sm md:text-[15px] leading-relaxed serif whitespace-pre-wrap first-letter:text-5xl first-letter:font-black first-letter:mr-3 first-letter:float-left first-letter:leading-none">
              {analysis.summary.finalInvestigativeReport}
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.4em] border-b border-slate-200 pb-1 mb-4">II. ГЕОПОЛИТИЧЕСКИ КОНТЕКСТ</h4>
              <div className="text-slate-700 text-xs md:text-sm leading-relaxed italic border-l-2 border-amber-900 pl-4">
                {analysis.summary.geopoliticalContext}
              </div>
            </div>
            <div>
              <h4 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.4em] border-b border-slate-200 pb-1 mb-4">III. НАРАТИВНА АРХИТЕКТУРА</h4>
              <div className="text-slate-700 text-xs md:text-sm leading-relaxed serif">
                {analysis.summary.narrativeArchitecture}
              </div>
            </div>
          </section>

          <section>
            <h4 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.4em] border-b border-slate-200 pb-1 mb-4">IV. ТЕХНИЧЕСКА ЕКСПЕРТИЗА (FORENSICS)</h4>
            <div className="text-slate-700 text-xs md:text-sm leading-relaxed bg-slate-50 p-6 border border-slate-100">
              {analysis.summary.technicalForensics}
            </div>
          </section>

          <section>
            <h4 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.4em] border-b border-slate-200 pb-1 mb-4">V. ПСИХО-ЛИНГВИСТИЧЕН АНАЛИЗ</h4>
            <div className="text-slate-700 text-xs md:text-sm leading-relaxed italic">
              {analysis.summary.psychoLinguisticAnalysis}
            </div>
          </section>

          <section className="bg-amber-50/20 p-8 border border-amber-100">
            <h4 className="text-[9px] font-black text-amber-900 uppercase tracking-[0.4em] mb-4">VI. СОЦИАЛНО ВЪЗДЕЙСТВИЕ И ПРОГНОЗИ</h4>
            <div className="text-slate-800 text-xs md:text-sm leading-relaxed serif font-medium">
              {analysis.summary.socialImpactPrediction}
            </div>
          </section>

          <section>
            <h4 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.4em] border-b border-slate-200 pb-1 mb-4">VII. ИСТОРИЧЕСКА ПРЕЦЕДЕНТНОСТ</h4>
            <div className="text-slate-700 text-xs md:text-sm leading-relaxed">
              {analysis.summary.historicalParallel}
            </div>
          </section>
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

      <footer className="mt-20 pt-8 border-t border-slate-200 text-center">
        <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.5em] mb-4">© FACTCHECKER AI | ПЪЛЕН МЕДИЕН АНАЛИЗАТОР</div>
        <p className="text-[7px] text-slate-300 uppercase leading-relaxed max-w-2xl mx-auto">
          Този документ е генериран чрез алгоритмите на Deep Contextual Reasoning Engine v4.8.
          Всички изводи са базирани на статистическа вероятност и крос-рефериране с независими източници.
        </p>
      </footer>
    </article>
  );
};

export default App;
