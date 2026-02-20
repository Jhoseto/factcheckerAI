import React, { useState, useRef, useEffect } from 'react';
import type { VideoAnalysis } from '../types';
import MobileHeader from './components/MobileHeader';
import ReliabilityChart from '../components/ReliabilityChart';

type TabId = 'summary' | 'claims' | 'manipulation' | 'transcript' | 'report' | 'visual' | 'bodyLanguage' | 'vocal' | 'deception' | 'humor' | 'psychological' | 'cultural';

interface MobileResultViewProps {
  analysis: VideoAnalysis;
  reportLoading: boolean;
  onSaveToArchive?: () => void;
  onBack?: () => void;
}

const SectionBlock: React.FC<{ title: string; content?: string }> = ({ title, content }) => {
  if (!content || content === 'Няма данни') return null;
  return (
    <div className="mobile-editorial-card rounded-xl p-4 mb-4 border-t-2 border-t-slate-800">
      <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-1 mb-3">{title}</h3>
      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap serif">{content}</p>
    </div>
  );
};

const MobileResultView: React.FC<MobileResultViewProps> = ({ analysis, reportLoading, onSaveToArchive, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const baseTabs: { id: TabId; label: string }[] = [
    { id: 'summary', label: 'Резюме' },
    { id: 'claims', label: 'Твърдения' },
    { id: 'manipulation', label: 'Манипулация' },
    { id: 'transcript', label: 'Транскрипт' },
  ];
  const deepTabs: { id: TabId; label: string }[] = analysis.analysisMode === 'deep'
    ? [
        { id: 'visual', label: 'Визуален' },
        { id: 'bodyLanguage', label: 'Тяло' },
        { id: 'vocal', label: 'Вокал' },
        { id: 'deception', label: 'Измама' },
        { id: 'humor', label: 'Хумор' },
        { id: 'psychological', label: 'Психо' },
        { id: 'cultural', label: 'Култура' },
      ]
    : [];
  const allTabs = [...baseTabs, ...deepTabs, { id: 'report' as TabId, label: 'Доклад' }];

  const checkScrollability = () => {
    if (!tabsScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabsScrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  useEffect(() => {
    checkScrollability();
    const el = tabsScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScrollability);
    const resizeObserver = new ResizeObserver(checkScrollability);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScrollability);
      resizeObserver.disconnect();
    };
  }, [allTabs.length]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (!tabsScrollRef.current) return;
    const scrollAmount = 200;
    tabsScrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <MobileHeader 
        title={analysis.videoTitle || 'Резултат'} 
        showBack 
        onBack={onBack}
        right={
          !analysis.id && onSaveToArchive ? (
            <button
              type="button"
              onClick={onSaveToArchive}
              className="mobile-tap px-3 py-1.5 rounded-lg bg-amber-900 text-white text-[9px] font-black uppercase tracking-wider touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-900/30 focus-visible:ring-offset-2 active:scale-[0.98] transition-transform duration-200"
            >
              Запази
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
        <div className="relative flex-shrink-0 bg-white border-b border-slate-200">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollTabs('left')}
              className="absolute left-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center bg-gradient-to-r from-white via-white/98 to-transparent touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-900/20 focus-visible:ring-offset-1 transition-opacity duration-200 active:opacity-70"
              aria-label="Скролвай наляво"
            >
              <div className="w-7 h-7 rounded-full bg-white/90 border border-amber-900/20 shadow-sm flex items-center justify-center backdrop-blur-sm">
                <svg className="w-4 h-4 text-amber-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            </button>
          )}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollTabs('right')}
              className="absolute right-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center bg-gradient-to-l from-white via-white/98 to-transparent touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-900/20 focus-visible:ring-offset-1 transition-opacity duration-200 active:opacity-70"
              aria-label="Скролвай надясно"
            >
              <div className="w-7 h-7 rounded-full bg-white/90 border border-amber-900/20 shadow-sm flex items-center justify-center backdrop-blur-sm">
                <svg className="w-4 h-4 text-amber-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          )}
          <div ref={tabsScrollRef} className="px-4 py-3 overflow-x-auto mobile-no-scrollbar">
            <div className="flex gap-2 min-w-max pb-1">
            {allTabs.map((tab) => {
              const isReport = tab.id === 'report';
              const disabled = isReport && reportLoading;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => !disabled && setActiveTab(tab.id)}
                  disabled={disabled}
                  className={`mobile-tap flex-shrink-0 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-900/20 focus-visible:ring-offset-2 ${
                    disabled ? 'bg-slate-100 text-slate-400' : activeTab === tab.id
                      ? 'bg-amber-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 active:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 pb-20">
          {activeTab === 'summary' && (
            <div className="space-y-4 mobile-fade-in">
              <div className="mobile-editorial-card rounded-xl p-4 border-l-4 border-l-slate-900">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Класификация</span>
                  <span className="px-2 py-0.5 rounded-sm border border-amber-900/30 bg-amber-50 text-amber-900 text-[10px] font-black uppercase tracking-tighter serif italic">
                    {analysis.summary.finalClassification}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                    <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Достоверност</p>
                    <p className="text-lg font-black text-emerald-900">{(analysis.summary.credibilityIndex * 100).toFixed(0)}%</p>
                  </div>
                  <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                    <p className="text-[9px] font-black text-orange-700 uppercase tracking-widest">Манипулация</p>
                    <p className="text-lg font-black text-orange-900">{(analysis.summary.manipulationIndex * 100).toFixed(0)}%</p>
                  </div>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed border-l-2 border-amber-900 pl-4 py-2 bg-amber-50/20 serif italic">
                  „{analysis.summary.overallSummary}“
                </p>
              </div>
              <div className="mobile-editorial-card rounded-xl p-4">
                <ReliabilityChart
                  data={analysis.timeline}
                  claims={analysis.claims}
                  totalDuration={analysis.summary.totalDuration}
                />
              </div>
            </div>
          )}

          {activeTab === 'claims' && (
            <div className="space-y-4 mobile-fade-in">
              {(analysis.claims || []).length === 0 && (
                <p className="text-slate-500 text-sm italic py-6">Няма извлечени твърдения.</p>
              )}
              {(analysis.claims || []).map((claim, idx) => (
                <div key={idx} className="mobile-editorial-card rounded-xl p-4 border-t-2 border-t-slate-800">
                  <span className={`inline-block px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border mb-3 ${
                    claim.veracity.toLowerCase().includes('невярно') ? 'border-red-700 text-red-700 bg-red-50' : 'border-emerald-700 text-emerald-700 bg-emerald-50'
                  }`}>
                    {claim.veracity}
                  </span>
                  <p className="text-base font-black text-slate-900 leading-tight serif italic mb-2">„{claim.quote}“</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{claim.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'manipulation' && (
            <div className="space-y-4 mobile-fade-in">
              {(analysis.manipulations || []).length === 0 && (
                <p className="text-slate-500 text-sm italic py-6">Няма манипулативни техники.</p>
              )}
              {(analysis.manipulations || []).map((m, idx) => {
                const severity = Math.round((m.severity > 1 ? m.severity / 100 : m.severity) * 100);
                const borderColor = severity >= 70 ? 'border-l-red-600' : severity >= 50 ? 'border-l-orange-600' : 'border-l-amber-600';
                return (
                  <div key={idx} className={`mobile-editorial-card rounded-xl p-4 border-l-4 ${borderColor}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{m.technique}</h4>
                      <span className={`text-sm font-black ${severity >= 70 ? 'text-red-600' : severity >= 50 ? 'text-orange-600' : 'text-amber-600'}`}>{severity}%</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2">
                      <p className="text-xs text-slate-700 leading-relaxed">{m.logic}</p>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Въздействие</p>
                    <p className="text-xs text-slate-600">{m.effect}</p>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="space-y-2 mobile-fade-in">
              {(analysis.transcription || []).map((line, idx) => (
                <div key={idx} className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0 w-12">{line.timestamp}</span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-amber-900 uppercase tracking-wider">{line.speaker}</p>
                    <p className="text-sm text-slate-800 leading-relaxed serif mt-0.5">{line.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'report' && (
            <div className="space-y-4 mobile-fade-in">
              <div className="mobile-editorial-card rounded-xl p-4 border-t-2 border-t-slate-900">
                <div className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap serif">
                  {analysis.synthesizedReport || analysis.summary?.finalInvestigativeReport || analysis.summary?.overallSummary || 'Докладът се генерира.'}
                </div>
              </div>
            </div>
          )}

          {['visual', 'bodyLanguage', 'vocal', 'deception', 'humor', 'psychological', 'cultural'].includes(activeTab) && (
            <SectionBlock
              title={allTabs.find(t => t.id === activeTab)?.label || activeTab}
              content={
                analysis.visualAnalysis && activeTab === 'visual' ? analysis.visualAnalysis :
                analysis.bodyLanguageAnalysis && activeTab === 'bodyLanguage' ? analysis.bodyLanguageAnalysis :
                analysis.vocalAnalysis && activeTab === 'vocal' ? analysis.vocalAnalysis :
                analysis.deceptionAnalysis && activeTab === 'deception' ? analysis.deceptionAnalysis :
                analysis.humorAnalysis && activeTab === 'humor' ? analysis.humorAnalysis :
                analysis.psychologicalProfile && activeTab === 'psychological' ? analysis.psychologicalProfile :
                analysis.culturalSymbolicAnalysis && activeTab === 'cultural' ? analysis.culturalSymbolicAnalysis :
                'Няма данни'
              }
            />
          )}
        </div>

      </div>
    </div>
  );
};

export default MobileResultView;
