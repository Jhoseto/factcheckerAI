import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { VideoAnalysis } from '../types';
import { getVerdictKey } from '../utils/verdictDisplay';
import MobileHeader from './components/MobileHeader';
import ReliabilityChart from '../components/ReliabilityChart';
import { TabIcon } from '../components/common/result-views/DeepTabIcons';
import { useLanguageSwitch } from '../hooks/useLanguageSwitch';

type TabId = 'summary' | 'claims' | 'manipulation' | 'report' | 'visual' | 'bodyLanguage' | 'vocal' | 'deception' | 'humor' | 'psychological' | 'cultural';

interface MobileResultViewProps {
  analysis: VideoAnalysis;
  reportLoading: boolean;
  onSaveToArchive?: () => void;
  onBack?: () => void;
}

const SectionBlock: React.FC<{ title: string; content?: string; noDataLabel: string }> = ({ title, content, noDataLabel }) => {
  if (!content || content === noDataLabel) return null;
  return (
    <div className="rounded-xl p-4 mb-4 bg-[#252525] border border-[#333]">
      <h3 className="text-[9px] font-black text-[#C4B091] uppercase tracking-widest border-b border-[#333] pb-1 mb-3">{title}</h3>
      <p className="text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  );
};

const MobileResultView: React.FC<MobileResultViewProps> = ({ analysis, reportLoading, onSaveToArchive, onBack }) => {
  const { t, i18n } = useTranslation();
  const { language, setLanguage } = useLanguageSwitch();
  const rawReport = analysis.synthesizedReport || analysis.summary?.finalInvestigativeReport || analysis.summary?.overallSummary || '';
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const allTabs = useMemo(() => {
    const base: { id: TabId; label: string }[] = [
      { id: 'summary', label: t('analysis.tabSummary') },
      { id: 'claims', label: t('analysis.tabClaims') },
      { id: 'manipulation', label: t('analysis.tabManipulation') },
    ];
    const deep: { id: TabId; label: string }[] = analysis.analysisMode === 'deep'
      ? [
        { id: 'visual', label: t('analysis.tabVisual') },
        { id: 'bodyLanguage', label: t('analysis.tabBodyLanguage') },
        { id: 'vocal', label: t('analysis.tabVocal') },
        { id: 'deception', label: t('analysis.tabDeception') },
        { id: 'humor', label: t('analysis.tabHumor') },
        { id: 'psychological', label: t('analysis.tabPsychological') },
        { id: 'cultural', label: t('analysis.tabCultural') },
      ]
      : [];
    return [...base, ...deep, { id: 'report' as TabId, label: t('report.tabReport') }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language, analysis.analysisMode]);

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
    <div className="flex flex-col h-full min-h-0 bg-[#1a1a1a]">
      <MobileHeader
        title={analysis.videoTitle || t('report.result')}
        showBack
        onBack={onBack}
        right={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#252525] rounded-lg p-0.5 border border-[#333]">
              <button
                type="button"
                onClick={() => setLanguage('bg')}
                className={`px-2.5 py-1 min-h-[28px] rounded-md text-[9px] font-black uppercase tracking-widest touch-manipulation transition-all duration-200 ${language === 'bg' ? 'text-[#111] bg-gradient-to-r from-[#C4B091] to-[#968B74] shadow-sm' : 'text-[#888]'}`}
              >
                BG
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 min-h-[28px] rounded-md text-[9px] font-black uppercase tracking-widest touch-manipulation transition-all duration-200 ${language === 'en' ? 'text-[#111] bg-gradient-to-r from-[#C4B091] to-[#968B74] shadow-sm' : 'text-[#888]'}`}
              >
                EN
              </button>
            </div>
            {!analysis.id && onSaveToArchive && (
              <button type="button" onClick={onSaveToArchive} className="mobile-tap px-3 py-1.5 min-h-[32px] rounded-lg bg-[#968B74] text-[#1a1a1a] text-[9px] font-black uppercase tracking-wider touch-manipulation focus:outline-none active:scale-[0.98] transition-transform duration-200 shadow-md">
                {t('mobile.save')}
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
        <div className="relative flex-shrink-0 bg-[#111] border-b border-[#333]">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollTabs('left')}
              className="absolute left-0 top-0 bottom-0 z-10 w-14 flex items-center justify-start pl-2 bg-gradient-to-r from-[#111] via-[#111]/90 to-transparent touch-manipulation focus:outline-none transition-opacity duration-300 active:opacity-70"
              aria-label={t('mobile.scrollLeft')}
            >
              <div className="w-8 h-8 rounded-full bg-[#1a1a1a]/80 backdrop-blur-md border border-[#968B74]/20 flex items-center justify-center shadow-lg min-h-[44px]">
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
              className="absolute right-0 top-0 bottom-0 z-10 w-14 flex items-center justify-end pr-2 bg-gradient-to-l from-[#111] via-[#111]/90 to-transparent touch-manipulation focus:outline-none transition-opacity duration-300 active:opacity-70"
              aria-label={t('mobile.scrollRight')}
            >
              <div className="w-8 h-8 rounded-full bg-[#1a1a1a]/80 backdrop-blur-md border border-[#968B74]/20 flex items-center justify-center shadow-lg min-h-[44px]">
                <svg className="w-4 h-4 text-[#C4B091]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          )}
          <div ref={tabsScrollRef} className="px-5 py-4 overflow-x-auto mobile-no-scrollbar">
            <div className="flex gap-2.5 min-w-max pb-1">
              {allTabs.map((tab) => {
                const isReport = tab.id === 'report';
                const disabled = isReport && reportLoading;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => !disabled && setActiveTab(tab.id)}
                    disabled={disabled}
                    className={`mobile-tap flex-shrink-0 px-5 py-2.5 min-h-[44px] rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 touch-manipulation focus:outline-none ${disabled ? 'bg-[#252525] text-[#555]' : activeTab === tab.id
                      ? 'bg-gradient-to-r from-[#C4B091] to-[#968B74] text-[#111] shadow-[0_4px_12px_rgba(196,176,145,0.25)]'
                      : 'bg-[#252525] text-[#aaa] border border-[#333] active:bg-[#333]'
                      }`}
                  >
                    <TabIcon id={tab.id as import('../components/common/result-views/DeepTabIcons').TabId} className={`w-3.5 h-3.5 mr-2 shrink-0 ${activeTab === tab.id ? 'opacity-90' : 'opacity-70'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-6 pb-28">
          {activeTab === 'summary' && (
            <div className="space-y-4 mobile-fade-in">
              <div className="rounded-xl p-4 bg-[#252525] border border-[#333] border-l-4 border-l-[#968B74]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[8px] font-black text-[#888] uppercase tracking-widest">{t('analysis.classificationLabel')}</span>
                  <span className="px-2 py-0.5 rounded-sm border border-[#968B74]/40 bg-[#968B74]/10 text-[#C4B091] text-[10px] font-black uppercase tracking-tighter">
                    {analysis.summary.finalClassification}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg bg-emerald-900/20 border border-emerald-700/40 p-3">
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{t('analysis.credibility')}</p>
                    <p className="text-lg font-black text-emerald-300">{(analysis.summary.credibilityIndex * 100).toFixed(0)}%</p>
                  </div>
                  <div className="rounded-lg bg-orange-900/20 border border-orange-700/40 p-3">
                    <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">{t('analysis.manipulationLabel')}</p>
                    <p className="text-lg font-black text-orange-300">{(analysis.summary.manipulationIndex * 100).toFixed(0)}%</p>
                  </div>
                </div>
                <p className="text-sm text-[#ccc] leading-relaxed border-l-2 border-[#968B74] pl-4 py-2 bg-[#1a1a1a] rounded-r">
                  „{analysis.summary.overallSummary}“
                </p>
              </div>
            </div>
          )}

          {activeTab === 'claims' && (
            <div className="space-y-5 mobile-fade-in">
              {(analysis.claims || []).length === 0 && (
                <p className="text-[#888] text-sm py-6">{t('analysis.noClaims')}</p>
              )}
              {(analysis.claims || []).map((claim: any, idx: number) => {
                const isTrue = !(['FALSE', 'MOSTLY_FALSE'].includes(claim.verdict || '') || (claim.veracity || '').toLowerCase().includes('невярно') || (claim.veracity || '').toLowerCase().includes('подвеждащо'));
                const badgeColor = isTrue ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60' : 'bg-red-950/40 text-red-400 border-red-900/60';
                const borderColor = isTrue ? 'border-l-emerald-600/60' : 'border-l-red-600/60';
                return (
                  <div key={idx} className={`bg-[#1a1a1a] rounded-2xl p-5 shadow-md border border-[#333] border-l-4 ${borderColor} relative overflow-hidden`} style={{ animationDelay: `${idx * 0.05}s` }}>
                    {/* Subtle Verdict Glow */}
                    <div className={`absolute top-0 left-0 bottom-0 w-8 blur-xl pointer-events-none ${isTrue ? 'bg-emerald-900/10' : 'bg-red-900/10'}`} />
                    <div className="flex flex-col gap-3 relative z-10">
                      <div className="flex justify-between items-start gap-3">
                        <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border flex-shrink-0 ${badgeColor}`}>
                          {t(getVerdictKey(claim))}
                        </span>
                        {claim.time && <span className="text-[10px] text-[#888] font-bold bg-[#252525] px-2 py-0.5 rounded border border-[#333] tabular-nums">{claim.time}</span>}
                      </div>
                      <p className="text-[13px] font-semibold text-[#E0E0E0] leading-snug">{claim.quote}</p>
                      <p className="text-xs text-[#aaa] mt-1 leading-relaxed border-t border-[#333]/50 pt-3">{(claim.explanation === 'Няма налична информация' || claim.explanation === 'No information available') ? t('analysis.noInfoAvailable') : claim.explanation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'manipulation' && (
            <div className="space-y-5 mobile-fade-in">
              {(analysis.manipulations || []).length === 0 && (
                <p className="text-[#888] text-sm py-6">{t('analysis.noManipulations')}</p>
              )}
              {(analysis.manipulations || []).map((man: any, idx: number) => (
                <div key={idx} className="bg-[#1a1a1a] rounded-2xl p-5 shadow-md border border-[#333] border-l-4 border-l-amber-600/60 relative overflow-hidden" style={{ animationDelay: `${idx * 0.05}s` }}>
                  {/* Subtle Manipulation Glow */}
                  <div className="absolute top-0 left-0 bottom-0 w-8 blur-xl pointer-events-none bg-amber-900/10" />
                  <div className="relative z-10">
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border bg-amber-950/40 text-amber-400 border-amber-900/60">
                        {t('mobile.manipulationDetected')}
                      </span>
                      {man.time && <span className="text-[10px] text-[#888] font-bold bg-[#252525] px-2 py-0.5 rounded border border-[#333] tabular-nums">{man.time}</span>}
                    </div>
                    <p className="text-[13px] font-semibold text-[#E0E0E0] mb-2 leading-snug">{man.technique}</p>
                    <p className="text-xs text-[#aaa] leading-relaxed border-t border-[#333]/50 pt-3">
                      {t('mobile.manipulationGoal')}: {man.goal}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'report' && (
            <div className="space-y-4 mobile-fade-in">
              <div className="rounded-xl p-4 bg-[#252525] border border-[#333]">
                <div className="text-[#ccc] text-sm leading-relaxed whitespace-pre-wrap">
                  {rawReport || t('analysis.reportGenerating')}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'psychological' && (
            <div className="space-y-5 mobile-fade-in">
              {(analysis.psychologicalProfile || []).length === 0 && (
                <p className="text-[#888] text-sm py-6">{t('analysis.noData')}</p>
              )}
              {(analysis.psychologicalProfile || []).map((prof: any, idx: number) => (
                <div key={idx} className="mobile-glass rounded-2xl p-5 border-l-4 border-l-purple-600/50" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border bg-purple-950/40 text-purple-400 border-purple-900/60 flex-shrink-0">
                      {t('mobile.psychTool')}
                    </span>
                    {prof.time && <span className="text-[10px] text-[#888] font-bold bg-[#252525] px-2 py-0.5 rounded border border-[#333] tabular-nums">{prof.time}</span>}
                  </div>
                  <p className="text-[13px] font-semibold text-[#E0E0E0] mb-2 leading-snug">{prof.behavior}</p>
                  <p className="text-xs text-[#aaa] leading-relaxed border-t border-[#333]/50 pt-3">{prof.analysis}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'chart' && (
            <div className="mobile-fade-in w-full overflow-hidden bg-[#1a1a1a] p-2 sm:p-5 rounded-3xl border border-[#333] shadow-lg">
              <ReliabilityChart data={analysis.timeline} claims={analysis.claims} totalDuration={analysis.summary.totalDuration} />
            </div>
          )}

          {['visual', 'bodyLanguage', 'vocal', 'deception', 'humor', 'cultural'].includes(activeTab) && (
            <SectionBlock
              title={allTabs.find(tab => tab.id === activeTab)?.label || activeTab}
              noDataLabel={t('analysis.noData')}
              content={
                analysis.visualAnalysis && activeTab === 'visual' ? analysis.visualAnalysis :
                  analysis.bodyLanguageAnalysis && activeTab === 'bodyLanguage' ? analysis.bodyLanguageAnalysis :
                    analysis.vocalAnalysis && activeTab === 'vocal' ? analysis.vocalAnalysis :
                      analysis.deceptionAnalysis && activeTab === 'deception' ? analysis.deceptionAnalysis :
                        analysis.humorAnalysis && activeTab === 'humor' ? analysis.humorAnalysis :
                          analysis.psychologicalProfile && activeTab === 'psychological' ? analysis.psychologicalProfile :
                            analysis.culturalSymbolicAnalysis && activeTab === 'cultural' ? analysis.culturalSymbolicAnalysis :
                              t('analysis.noData')
              }
            />
          )}
        </div>

      </div>
    </div>
  );
};

export default MobileResultView;
