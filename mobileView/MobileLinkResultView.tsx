import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { VideoAnalysis } from '../types';
import MobileHeader from './components/MobileHeader';
import ReliabilityGauge from '../components/linkAudit/ReliabilityGauge';

type TabId = 'summary' | 'claims' | 'manipulation' | 'report';

interface MobileLinkResultViewProps {
  analysis: VideoAnalysis;
  reportLoading: boolean;
  onSaveToArchive?: () => void;
  onBack?: () => void;
}

const MobileLinkResultView: React.FC<MobileLinkResultViewProps> = ({ analysis, reportLoading, onSaveToArchive, onBack }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const allTabs: { id: TabId; label: string }[] = [
    { id: 'summary', label: t('analysis.tabSummary') },
    { id: 'claims', label: t('analysis.tabClaimsVerification') },
    { id: 'manipulation', label: t('analysis.tabManipulation') },
    { id: 'report', label: t('report.tabReport') },
  ];

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

  const stats = analysis.summary.detailedStats || {
    factualAccuracy: analysis.summary.credibilityIndex || 0,
    logicalSoundness: 0,
    emotionalBias: 0,
    propagandaScore: 0,
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#1a1a1a]">
      <MobileHeader 
        title={analysis.videoTitle || t('report.result')} 
        showBack 
        onBack={onBack}
        right={
          !analysis.id && onSaveToArchive ? (
            <button
              type="button"
              onClick={onSaveToArchive}
              className="mobile-tap px-3 py-2 min-h-[36px] rounded-lg bg-[#968B74] text-[#1a1a1a] text-[9px] font-black uppercase tracking-wider touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B091]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] active:scale-[0.98] transition-transform duration-200"
            >
              {t('mobile.save')}
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
        <div className="relative flex-shrink-0 bg-[#1a1a1a] border-b border-[#333]">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollTabs('left')}
              className="absolute left-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center bg-gradient-to-r from-[#1a1a1a] via-[#1a1a1a]/98 to-transparent touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B091]/30 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1a1a1a] transition-opacity duration-200 active:opacity-70"
              aria-label={t('mobile.scrollLeft')}
            >
              <div className="w-8 h-8 rounded-full bg-[#252525] border border-[#333] flex items-center justify-center min-h-[44px]">
                <svg className="w-4 h-4 text-[#C4B091]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            </button>
          )}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollTabs('right')}
              className="absolute right-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center bg-gradient-to-l from-[#1a1a1a] via-[#1a1a1a]/98 to-transparent touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B091]/30 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1a1a1a] transition-opacity duration-200 active:opacity-70"
              aria-label={t('mobile.scrollRight')}
            >
              <div className="w-8 h-8 rounded-full bg-[#252525] border border-[#333] flex items-center justify-center min-h-[44px]">
                <svg className="w-4 h-4 text-[#C4B091]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
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
                  className={`mobile-tap flex-shrink-0 px-4 py-2.5 min-h-[44px] rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B091]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] ${
                    disabled ? 'bg-[#252525] text-[#666]' : activeTab === tab.id
                      ? 'bg-[#968B74] text-[#1a1a1a]'
                      : 'bg-[#252525] text-[#aaa] border border-[#333] active:bg-[#333]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 pb-24">
          {activeTab === 'summary' && (
            <div className="space-y-4 mobile-fade-in">
              <div className="rounded-xl p-4 bg-[#252525] border border-[#333] border-l-4 border-l-[#968B74]">
                <div className="flex items-center justify-center mb-4">
                  <ReliabilityGauge score={stats.factualAccuracy} size={160} />
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[8px] font-black text-[#888] uppercase tracking-widest">{t('analysis.classificationLabel')}</span>
                  <span className={`px-2 py-0.5 rounded-sm border text-[10px] font-black uppercase tracking-tighter ${
                    analysis.summary.finalClassification === 'ACCURATE' || analysis.summary.finalClassification === 'MOSTLY_ACCURATE'
                      ? 'border-emerald-600/60 bg-emerald-900/20 text-emerald-400'
                      : analysis.summary.finalClassification === 'MIXED'
                      ? 'border-[#968B74]/60 bg-[#968B74]/10 text-[#C4B091]'
                      : 'border-red-600/60 bg-red-900/20 text-red-400'
                  }`}>
                    {analysis.summary.finalClassification === 'ACCURATE' ? t('report.classificationAccurate') :
                     analysis.summary.finalClassification === 'MOSTLY_ACCURATE' ? t('report.classificationMostlyAccurate') :
                     analysis.summary.finalClassification === 'MIXED' ? t('report.classificationMixed') :
                     analysis.summary.finalClassification === 'MISLEADING' ? t('report.classificationMisleading') : t('report.classificationFalse')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg bg-emerald-900/20 border border-emerald-700/40 p-3">
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{t('analysis.factualAccuracy')}</p>
                    <p className="text-lg font-black text-emerald-300">{(stats.factualAccuracy * 100).toFixed(0)}%</p>
                  </div>
                  <div className="rounded-lg bg-blue-900/20 border border-blue-700/40 p-3">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{t('analysis.logicalSoundness')}</p>
                    <p className="text-lg font-black text-blue-300">{(stats.logicalSoundness * 100).toFixed(0)}%</p>
                  </div>
                  <div className="rounded-lg bg-orange-900/20 border border-orange-700/40 p-3">
                    <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">{t('analysis.emotionalBias')}</p>
                    <p className="text-lg font-black text-orange-300">{(stats.emotionalBias * 100).toFixed(0)}%</p>
                  </div>
                  <div className="rounded-lg bg-red-900/20 border border-red-700/40 p-3">
                    <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">{t('analysis.propagandaScore')}</p>
                    <p className="text-lg font-black text-red-300">{(stats.propagandaScore * 100).toFixed(0)}%</p>
                  </div>
                </div>
                <p className="text-sm text-[#ccc] leading-relaxed border-l-2 border-[#968B74] pl-4 py-2 bg-[#1a1a1a] rounded-r">
                  „{analysis.summary.overallSummary}"
                </p>
                {analysis.summary.recommendations && (
                  <div className="mt-4 pt-4 border-t border-[#333]">
                    <h3 className="text-[9px] font-black text-[#C4B091] uppercase tracking-widest mb-2">{t('mobile.strategicRecommendations')}</h3>
                    <p className="text-xs text-[#aaa] leading-relaxed whitespace-pre-wrap">{analysis.summary.recommendations}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'claims' && (
            <div className="space-y-4 mobile-fade-in">
              {(analysis.claims || []).length === 0 && (
                <p className="text-[#888] text-sm py-6">{t('analysis.noClaims')}</p>
              )}
              {(analysis.claims || []).map((claim, idx) => (
                <div key={idx} className="rounded-xl p-4 bg-[#252525] border border-[#333]">
                  <span className={`inline-block px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border mb-3 rounded ${
                    claim.veracity.toLowerCase().includes('невярно') ? 'border-red-600/60 text-red-400 bg-red-900/20' : 'border-emerald-600/60 text-emerald-400 bg-emerald-900/20'
                  }`}>
                    {claim.veracity}
                  </span>
                  <p className="text-base font-black text-[#E0E0E0] leading-tight mb-2">„{claim.quote}"</p>
                  <p className="text-xs text-[#aaa] leading-relaxed">{claim.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'manipulation' && (
            <div className="space-y-4 mobile-fade-in">
              {(analysis.manipulations || []).length === 0 && (
                <p className="text-[#888] text-sm py-6">{t('analysis.noManipulations')}</p>
              )}
              {(analysis.manipulations || []).map((m, idx) => {
                const severity = Math.round((m.severity > 1 ? m.severity / 100 : m.severity) * 100);
                const borderColor = severity >= 70 ? 'border-l-red-500' : severity >= 50 ? 'border-l-orange-500' : 'border-l-[#968B74]';
                return (
                  <div key={idx} className={`rounded-xl p-4 bg-[#252525] border border-[#333] border-l-4 ${borderColor}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-black text-[#E0E0E0] uppercase tracking-tight">{m.technique}</h4>
                      <span className={`text-sm font-black ${severity >= 70 ? 'text-red-400' : severity >= 50 ? 'text-orange-400' : 'text-[#C4B091]'}`}>{severity}%</span>
                    </div>
                    <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 mb-2">
                      <p className="text-xs text-[#ccc] leading-relaxed">{m.logic}</p>
                    </div>
                    {m.effect && (
                      <>
                        <p className="text-[10px] font-bold text-[#888] uppercase tracking-wider">{t('analysis.effect')}</p>
                        <p className="text-xs text-[#aaa]">{m.effect}</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'report' && (
            <div className="space-y-4 mobile-fade-in">
              <div className="rounded-xl p-4 bg-[#252525] border border-[#333]">
                <div className="text-center mb-6 pb-4 border-b-2 border-[#333]">
                  <p className="text-[9px] font-black text-[#C4B091] uppercase tracking-[0.3em] mb-2">{t('report.officialReport')}</p>
                  <h2 className="text-2xl font-black text-[#E0E0E0]">{t('report.finalAnalysis')}</h2>
                </div>
                <div className="text-[#ccc] text-sm leading-relaxed whitespace-pre-wrap">
                  {analysis.summary?.finalInvestigativeReport || analysis.summary?.overallSummary || t('analysis.reportGenerating')}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default MobileLinkResultView;
