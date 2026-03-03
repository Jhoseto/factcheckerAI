import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { VideoAnalysis } from '../../../types';
import ReliabilityChart from '../../ReliabilityChart';
import MetricBlock from '../MetricBlock';
import { useAuth } from '../../../contexts/AuthContext';
import { makeAnalysisPublic } from '../../../services/archiveService';
import { useTranslation } from 'react-i18next';
import { TabIcon, SectionIcon } from './DeepTabIcons';
import { getVerdictKey } from '../../../utils/verdictDisplay';

interface VideoResultViewProps {
    analysis: VideoAnalysis;
    reportLoading: boolean;
    onSaveToArchive?: () => void;
    onReset?: () => void;
    slotUsage?: { used: number; max: number };
    isSaved?: boolean;
}

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

const METRIC_KEYS: Record<string, string> = {
    factualAccuracy: 'analysis.factualAccuracy',
    logicalSoundness: 'analysis.logicalSoundness',
    emotionalBias: 'analysis.emotionalBias',
    propagandaScore: 'analysis.propagandaScore',
    sourceReliability: 'analysis.sourceReliability',
    subjectivityScore: 'analysis.subjectivityScore',
    objectivityScore: 'analysis.objectivityScore',
    biasIntensity: 'analysis.biasIntensity',
    narrativeConsistencyScore: 'analysis.narrativeConsistencyScore',
    semanticDensity: 'analysis.semanticDensity',
    contextualStability: 'analysis.contextualStability'
};

const renderBoldBronze = (text: string) => {
    const s = typeof text === 'string' ? text : String(text ?? '');
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
            ? <strong key={i} className="text-[#C4B091] font-semibold">{part.slice(2, -2)}</strong>
            : part
    );
};

const MultimodalSection: React.FC<{ title: string; content?: string | unknown; color: string; icon?: React.ReactNode }> = ({ title, content, icon }) => {
    const { t } = useTranslation();
    const text = typeof content === 'string' ? content : (content && typeof content === 'object' && content !== null
        ? String((content as { text?: string }).text ?? (content as { summary?: string }).summary ?? (content as Record<string, unknown>).content ?? '')
        : '');
    if (!text || text === t('analysis.noData')) return null;

    const segments = text.split(/(?=\d+\.\s)/).map((s: string) => s.trim()).filter(Boolean);

    const renderSegment = (segment: string, idx: number) => {
        const numMatch = segment.match(/^(\d+)\.\s*(.*)/s);
        if (numMatch) {
            const [, num, rest] = numMatch;
            const colonIdx = rest.indexOf(':');
            const label = colonIdx >= 0 ? rest.slice(0, colonIdx + 1).replace(/\*\*/g, '').trim() : '';
            const body = colonIdx >= 0 ? rest.slice(colonIdx + 1).trim() : rest;
            return (
                <div key={idx} className="mt-8 mb-5">
                    <div className="flex gap-3 items-baseline">
                        <span className="text-[#C4B091] font-black text-lg md:text-xl shrink-0">{num}.</span>
                        {label && (
                            <span className="text-[#C4B091] font-black text-sm md:text-base tracking-wide border-b border-[#968B74]/50 pb-1">
                                {label}
                            </span>
                        )}
                    </div>
                    <div className="mt-3 pl-0 text-[#ddd] text-[15px] md:text-base leading-[1.7] space-y-3">
                        {body ? body.split(/\n\n+/).map((para, i) => (
                            <p key={i}>{para.trim() ? renderBoldBronze(para.trim()) : null}</p>
                        )) : null}
                    </div>
                </div>
            );
        }
        return <p key={idx} className="mb-4 text-[#ddd] text-[15px] md:text-base leading-[1.7]">{renderBoldBronze(segment)}</p>;
    };

    return (
        <div className="editorial-card p-6 md:p-10 border-l-2 border-l-[#968B74]/50 animate-fadeIn">
            <div className="mb-6 pb-4 border-b border-[#333] flex items-center gap-3">
                {icon && <span className="text-[#968B74]">{icon}</span>}
                <h3 className="text-xl md:text-2xl font-black text-[#C4B091] uppercase tracking-tight">{title}</h3>
            </div>
            <div className="max-w-none">
                {segments.map((seg, idx) => renderSegment(seg, idx))}
            </div>
        </div>
    );
};

const ReportView: React.FC<{ analysis: VideoAnalysis; reportRef?: React.RefObject<HTMLElement>; reportLoading?: boolean }> = ({ analysis, reportRef, reportLoading }) => {
    const { t, i18n } = useTranslation();
    const reportText = analysis.synthesizedReport || analysis.summary.finalInvestigativeReport || '';

    // Parse markdown-like report into structured sections
    const renderReportContent = (text: string) => {
        const str = typeof text === 'string' ? text : '';
        if (!str) return null;
        const sections = str.split(/\n(?=# )/).filter(Boolean);

        return sections.map((section, sIdx) => {
            const lines = section.split('\n');
            const titleLine = lines[0] || '';
            const isMainSection = titleLine.startsWith('# ') && !titleLine.startsWith('## ');
            const sectionTitle = titleLine.replace(/^#+\s*/, '').trim();
            const bodyLines = lines.slice(1);

            return (
                <section key={sIdx} className={`mb-10 ${sIdx === 0 ? '' : 'pt-8 border-t border-[#333]'}`}>
                    {sectionTitle && (
                        <h4 className={`text-[9px] font-black uppercase tracking-[0.4em] pb-2 mb-6 border-b ${isMainSection ? 'text-[#C4B091] border-[#968B74]/30' : 'text-[#888] border-[#333]'
                            }`}>
                            {sectionTitle}
                        </h4>
                    )}
                    <div className={`text-[#ddd] text-[15px] md:text-base leading-[1.7] font-sans ${sIdx === 0 ? 'first-letter:text-5xl first-letter:font-black first-letter:mr-3 first-letter:float-left first-letter:leading-none first-letter:text-[#C4B091]' : ''}`}>
                        {bodyLines.map((line, lIdx) => {
                            const lineStr = typeof line === 'string' ? line : (line != null && typeof line === 'object' && 'details' in line ? String((line as { details?: unknown }).details) : String(line ?? ''));
                            const trimmed = lineStr.trim();
                            if (!trimmed || trimmed === '[object Object]') return null;
                            if (trimmed.startsWith('## ')) {
                                return <h5 key={lIdx} className="text-base md:text-lg font-black text-[#C4B091] uppercase mt-8 mb-3 tracking-tight border-b border-[#968B74]/30 pb-2">{trimmed.replace(/^##\s*/, '')}</h5>;
                            }
                            if (trimmed.startsWith('### ')) {
                                return <h6 key={lIdx} className="text-sm md:text-base font-black text-[#968B74] mt-6 mb-2 tracking-tight">{trimmed.replace(/^###\s*/, '')}</h6>;
                            }
                            if (trimmed === '---') {
                                return <hr key={lIdx} className="my-6 border-[#333]" />;
                            }
                            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                                return <li key={lIdx} className="flex gap-2 mt-3 mb-1"><span className="text-[#968B74] font-black shrink-0">•</span><span className="text-[#ccc]">{renderInlineMarkdown(trimmed.substring(2))}</span></li>;
                            }
                            if (/^\d+\.\s/.test(trimmed)) {
                                const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
                                const num = numMatch ? numMatch[1] : '';
                                const rest = numMatch ? numMatch[2] : trimmed.replace(/^\d+\.\s*/, '');
                                return (
                                    <div key={lIdx} className="mt-6 mb-3 flex gap-3 items-baseline">
                                        <span className="text-[#C4B091] font-black text-lg md:text-xl shrink-0 w-8">{num}.</span>
                                        <span className="text-[#ddd] text-[15px] md:text-base leading-[1.7]">{renderInlineMarkdown(rest)}</span>
                                    </div>
                                );
                            }
                            if (trimmed.startsWith('> ')) {
                                return <blockquote key={lIdx} className="border-l-4 border-[#968B74] pl-4 text-[#888] my-4">{renderInlineMarkdown(trimmed.substring(2))}</blockquote>;
                            }
                            return <p key={lIdx} className="mb-4 leading-[1.7]">{renderInlineMarkdown(trimmed)}</p>;
                        })}
                    </div>
                </section>
            );
        });
    };

    // Render inline markdown (bold, italic)
    const renderInlineMarkdown = (text: string) => {
        const s = typeof text === 'string' ? text : String(text ?? '');
        const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-black text-[#C4B091]">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={i} className="text-[#ddd]">{part.slice(1, -1)}</em>;
            }
            return part;
        });
    };

    return (
        <article ref={reportRef} id="full-report-article" className="max-w-[1100px] mx-auto editorial-card p-8 md:p-12 border border-[#968B74]/20 relative">
            <header className="mb-12 pb-8 border-b-2 border-[#333] text-center">
                <div className="text-[9px] font-black text-[#968B74] uppercase tracking-[0.6em] mb-4">{t('analysis.classifiedDossier')} #{analysis.id?.substring(0, 8)}</div>
                <h3 className="text-2xl md:text-4xl font-black text-[#E0E0E0] tracking-tight uppercase mb-4  leading-tight">{analysis.videoTitle}</h3>
                <div className="flex justify-center gap-10 text-[8px] font-bold text-[#666] uppercase tracking-widest">
                    <span>{t('analysis.sourceLabel')} {analysis.videoAuthor}</span>
                    <span>{t('analysis.dateLabel')} {new Date(analysis.timestamp).toLocaleString(i18n.language === 'en' ? 'en-GB' : 'bg-BG', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span>{t('analysis.engineLabel')} DCGE v4.8</span>
                </div>
                {analysis.synthesizedReport && (
                    <div className="mt-4 text-[8px] font-black text-[#C4B091] uppercase tracking-widest">✦ {t('analysis.synthesizedReport')} ✦</div>
                )}
            </header>

            {reportLoading ? (
                <div className="text-center py-20 animate-pulse">
                    <div className="inline-block w-8 h-8 border-2 border-[#968B74] border-t-transparent rounded-full animate-spin mb-6"></div>
                    <h4 className="text-lg font-black text-[#C4B091] uppercase tracking-widest mb-2">{t('analysis.reportGeneratingTitle')}</h4>
                    <p className="text-xs text-[#666] uppercase tracking-wider">{t('analysis.reportGeneratingSub')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                    <div className="md:col-span-8 space-y-2">
                        {renderReportContent(reportText)}
                    </div>

                    <aside className="md:col-span-4 space-y-8">
                        <div className="p-6 bg-[#1a1a1a] border border-[#333] rounded-sm">
                            <h4 className="text-[8px] font-black text-[#968B74] uppercase tracking-widest mb-6 border-b border-[#333] pb-2 text-center">{t('analysis.analyticalMetrics')}</h4>
                            <div className="space-y-6">
                                {Object.entries(analysis.summary.detailedStats || {}).map(([key, val], idx) => {
                                    const num = typeof val === 'number' && !Number.isNaN(val) ? val : 0;
                                    return (
                                        <div key={idx}>
                                            <div className="flex justify-between text-[7px] font-black uppercase mb-1">
                                                <span className="text-[#666]">{t(METRIC_KEYS[key] || key)}</span>
                                                <span className="text-[#C4B091]">{Math.round(num * 100)}%</span>
                                            </div>
                                            <div className="w-full h-1 bg-[#333] rounded-full overflow-hidden">
                                                <div className="h-full bg-[#968B74]" style={{ width: `${num * 100}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-6 border border-[#968B74]/30 text-center bg-[#252525]">
                            <div className="w-10 h-10 border-2 border-[#968B74] rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-[#C4B091] font-black text-xl">✓</span>
                            </div>
                            <p className="text-[8px] font-black text-[#E0E0E0] uppercase leading-relaxed mb-1 tracking-widest">{t('analysis.authenticated')}</p>
                            <p className="text-[7px] font-bold text-[#666] uppercase tracking-tight">{t('analysis.verifiedAgainst')}</p>
                        </div>

                        <div className="p-6 bg-[#252525] border border-[#333] rounded-sm">
                            <h4 className="text-[9px] font-black text-[#968B74] uppercase mb-4 tracking-widest">{t('analysis.strategicIntent')}</h4>
                            <p className="text-[15px] text-[#ccc] leading-[1.6]">
                                {(() => {
                                    const v = analysis.summary.strategicIntent;
                                    if (typeof v === 'string') return v;
                                    if (Array.isArray(v)) return v.map((it: any) => it?.details ?? it?.point ?? (typeof it === 'string' ? it : '')).filter(Boolean).join('. ');
                                    if (v && typeof v === 'object' && ('details' in v || 'point' in v)) return String((v as any).details ?? (v as any).point ?? '');
                                    return '';
                                })()}
                            </p>
                        </div>

                        <div className="p-6 bg-[#1a1a1a] border border-[#333] text-[8px] text-[#555] font-mono leading-tight uppercase rounded-sm">
                            {t('analysis.auditId')} {analysis.id}<br />
                            {t('analysis.nodeLabel')} SEREZLIEV_G_UNIT<br />
                            {t('analysis.statusLabel')} FINAL_VERIFICATION<br />
                            {t('analysis.hashLabel')} {Math.random().toString(16).slice(2, 18).toUpperCase()}
                        </div>
                    </aside>
                </div>
            )}

            <footer className="mt-20 pt-8 border-t border-[#333] text-center">
                <div className="text-[9px] font-black text-[#555] uppercase tracking-[0.5em] mb-4">{t('analysis.footerCopyright')}</div>
                <p className="text-[7px] text-[#444] uppercase leading-relaxed max-w-2xl mx-auto">
                    {t('analysis.footerDisclaimer')}
                    {' '}{t('analysis.footerDisclaimer2')}
                </p>
            </footer>
        </article>
    );
};

import ShareModal from '../ShareModal';

const VideoResultView: React.FC<VideoResultViewProps> = ({ analysis, reportLoading, onSaveToArchive, onReset, slotUsage, isSaved = false }) => {
    const { t, i18n } = useTranslation();
    const { currentUser } = useAuth();
    // Detect the language the analysis content was generated in
    const analysisLang: 'bg' | 'en' = (analysis as any).lang || ((analysis.summary?.overallSummary || '').match(/[а-яА-ЯёЁ]/) ? 'bg' : 'en');
    const [activeTab, setActiveTab] = useState<'summary' | 'claims' | 'manipulation' | 'report' | 'visual' | 'bodyLanguage' | 'vocal' | 'deception' | 'humor' | 'psychological' | 'cultural'>('summary');
    const [isExporting, setIsExporting] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const fullReportRef = React.useRef<HTMLElement>(null);

    const handleShare = async () => {
        if (!analysis.id) return;
        // Mark analysis as public when sharing
        if (currentUser && analysis.id) {
            try {
                await makeAnalysisPublic(analysis.id, currentUser.uid);
                console.log('Analysis marked as public:', analysis.id);
            } catch (error) {
                console.error('Failed to make analysis public:', error);
                alert(t('analysis.errorMakePublic'));
                return; // Don't open share modal if marking as public failed
            }
        }
        setIsShareModalOpen(true);
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



    const sidebarContent = (
        <>
                {i18n.language !== analysisLang && (
                    <div className="mb-4 px-3 py-2 border border-[#968B74]/30 bg-[#968B74]/10 rounded-sm text-[8px] text-[#C4B091] uppercase tracking-wider leading-relaxed">
                        {t('report.contentLangNote', { lang: analysisLang === 'bg' ? 'BG' : 'EN' })}
                    </div>
                )}
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-5">
                    <MetricBlock label={t('analysis.credibilityIndex')} value={analysis.summary.credibilityIndex} color="emerald" />
                    <MetricBlock label={t('analysis.manipulationIndex')} value={analysis.summary.manipulationIndex} color="orange" />
                </div>
                <div className="editorial-card p-5 border-l-2 border-l-[#968B74] mt-4 mb-4">
                    <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-2">{t('analysis.classification')}</p>
                    <span className="text-[#C4B091] font-black text-sm md:text-base block leading-tight uppercase tracking-tighter">{analysis.summary.finalClassification}</span>
                </div>
                <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
                    <p className="text-[7px] font-black text-[#968B74] uppercase tracking-widest mb-2">{t('analysis.priceOfAnalysis')}</p>
                    <p className="text-lg font-black text-bronze-gradient">{(analysis.pointsCost ?? 0).toLocaleString('bg-BG')} {t('common.points')}</p>
                </div>
                <div className="flex flex-col gap-4">
                    {!isSaved && onSaveToArchive && (
                        <button
                            onClick={onSaveToArchive}
                            disabled={slotUsage ? slotUsage.used >= slotUsage.max : false}
                            className={slotUsage && slotUsage.used >= slotUsage.max ? 'px-5 py-3.5 text-[10px] font-black uppercase tracking-widest w-full rounded-sm bg-[#333] text-[#555] cursor-not-allowed border border-[#333]' : 'btn-luxury-solid px-5 py-3.5 text-[10px] font-black uppercase tracking-widest w-full rounded-sm'}
                        >
                            {slotUsage && slotUsage.used >= slotUsage.max ? t('common.noSlots') : t('common.saveToArchiveSlots', { used: slotUsage?.used ?? 0, max: slotUsage?.max ?? 0 })}
                        </button>
                    )}
                    <div className="w-full relative group">
                        <button
                            onClick={isSaved ? handleShare : undefined}
                            disabled={!isSaved}
                            className={`px-5 py-3.5 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full rounded-sm ${isSaved ? 'btn-luxury-solid' : 'bg-[#333] text-[#555] cursor-not-allowed border border-[#333]'}`}
                        >
                            {t('common.shareReport')}
                        </button>
                        {!isSaved && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#252525] border border-[#968B74]/30 text-[#C4B091] text-[9px] font-bold uppercase tracking-wide rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                {t('common.saveToShare')}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#252525]"></div>
                            </div>
                        )}
                    </div>
                    {onReset && (
                        <button onClick={onReset} className="btn-luxury px-5 py-3.5 text-[10px] font-black uppercase tracking-widest w-full rounded-sm flex items-center justify-center gap-2 hover:border-[#8b4a4a] hover:text-[#c66]" title={t('analysis.closeAndNew')}>
                            <span>✕</span> {t('common.close')}
                        </button>
                    )}
                </div>
        </>
    );

    const allTabs = useMemo(() => {
        const base = [
            { id: 'summary', label: t('analysis.tabSummary') },
            { id: 'claims', label: t('analysis.tabClaims') },
            { id: 'manipulation', label: t('analysis.tabManipulation') },
        ];
        const deep = analysis.analysisMode === 'deep' ? [
            { id: 'visual', label: t('analysis.tabVisual') },
            { id: 'bodyLanguage', label: t('analysis.tabBodyLanguage') },
            { id: 'vocal', label: t('analysis.tabVocal') },
            { id: 'deception', label: t('analysis.tabDeception') },
            { id: 'humor', label: t('analysis.tabHumor') },
            { id: 'psychological', label: t('analysis.tabPsychological') },
            { id: 'cultural', label: t('analysis.tabCultural') },
        ] : [];
        return [...base, ...deep, { id: 'report', label: t('analysis.tabFinalReport') }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [i18n.language, analysis.analysisMode]);

    const tabsBarContent = (
        <>
            {allTabs.map(tab => {
                const isReportTab = tab.id === 'report';
                const isDisabled = isReportTab && reportLoading;
                return (
                    <button
                        key={tab.id}
                        onClick={() => !isDisabled && setActiveTab(tab.id as any)}
                        disabled={isDisabled}
                        className={`text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap pb-1 relative transition-all flex items-center gap-2 ${isDisabled ? 'text-[#444] cursor-not-allowed' : activeTab === tab.id ? 'text-[#C4B091]' : 'text-[#666] hover:text-[#C4B091]'}`}
                    >
                        <TabIcon id={tab.id as import('./DeepTabIcons').TabId} className="w-4 h-4" />
                        {tab.label}
                        {isReportTab && reportLoading && <span className="inline-block w-3 h-3 border-2 border-[#968B74] border-t-transparent rounded-full animate-spin"></span>}
                        {activeTab === tab.id && !isDisabled && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#968B74]"></div>}
                    </button>
                );
            })}
        </>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn relative w-full">
            {createPortal(
                <div className="hidden lg:block fixed top-32 left-0 right-0 z-[100] print:hidden">
                    <div className="w-full max-w-[1600px] mx-auto px-10">
                        <div className="grid grid-cols-12 gap-8">
                            <div className="hidden lg:block lg:col-span-3" aria-hidden />
                            <div className="min-w-0 lg:col-span-9 border-b border-[#333] bg-[#1a1a1a]/95 backdrop-blur-md py-4 px-6 flex flex-wrap gap-x-6 gap-y-2">
                                {tabsBarContent}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {createPortal(
                <aside className="hidden lg:block fixed top-32 left-[max(2.5rem,calc(50%-800px+2.5rem))] w-[min(380px,calc((100vw-5rem)*3/12))] max-h-[calc(100vh-8rem)] overflow-y-auto z-[90] py-6 pl-5 pr-4 print:hidden bg-[#1a1a1a]/95 backdrop-blur-md flex flex-col gap-8">
                    {sidebarContent}
                </aside>,
                document.body
            )}
            <div className="hidden lg:block lg:col-span-3" aria-hidden />
            <aside className="lg:hidden col-span-1 lg:col-span-3 print:hidden flex flex-col gap-8 px-4 py-5">
                {sidebarContent}
            </aside>

            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                shareUrl={analysis.id ? `${window.location.origin}/report/${analysis.id}` : ''}
            />

            <main className="lg:col-span-9 space-y-0">
                <nav className="lg:hidden border-b border-[#333] bg-[#1a1a1a] py-4 px-4 print:hidden">
                    <div className="flex flex-wrap gap-x-6 gap-y-2">{tabsBarContent}</div>
                </nav>
                <div className="h-[52px]" aria-hidden />

                <section className="min-h-[400px] pt-2 pb-8">
                    {activeTab === 'summary' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="editorial-card p-6 md:p-8 border-l-4 border-l-[#968B74] space-y-4">
                                <div className="flex justify-between items-start relative">
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest">{t('analysis.objectLabel')}</p>
                                        <h2 className="text-xl md:text-3xl font-black text-[#E0E0E0] uppercase tracking-tight  leading-tight pr-24">{analysis.videoTitle}</h2>
                                    </div>
                                    <div className={`px-2 py-0.5 border ${analysis.analysisMode === 'deep' ? 'bg-[#968B74] border-[#968B74] text-[#1a1a1a]' : 'border-[#333] text-[#666]'} text-[7px] font-black uppercase tracking-[0.2em] rounded-sm absolute top-0 right-0`}>
                                        {analysis.analysisMode === 'deep' ? t('analysis.deepAnalysis') : t('analysis.standardAnalysis')}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[#333]">
                                    <div><p className="text-[9px] font-black text-[#666] uppercase mb-0.5">{t('analysis.source')}</p><p className="text-sm font-black text-[#C4B091] uppercase truncate">{analysis.videoAuthor}</p></div>
                                    <div><p className="text-[9px] font-black text-[#666] uppercase mb-0.5">{t('analysis.duration')}</p><p className="text-sm font-black text-[#E0E0E0] uppercase">{analysis.summary.totalDuration}</p></div>
                                    <div><p className="text-[9px] font-black text-[#666] uppercase mb-0.5">{t('analysis.date')}</p><p className="text-sm font-black text-[#E0E0E0] uppercase">{new Date(analysis.timestamp).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'bg-BG', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
                                    <div><p className="text-[9px] font-black text-[#666] uppercase mb-0.5">Audit ID</p><p className="text-sm font-black text-[#968B74] uppercase">#{analysis.id}</p></div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-[9px] font-black text-[#968B74] uppercase tracking-widest border-b border-[#968B74]/50 pb-1 inline-flex items-center gap-2">
                                    <SectionIcon id="summary" className="w-4 h-4" /> {t('analysis.executiveSummary')}
                                </h3>
                                <p className="text-[#ddd] text-base md:text-lg leading-[1.65]  border-l-2 border-[#968B74] pl-6 py-2 bg-[#252525]/50">„{analysis.summary.overallSummary}“</p>
                            </div>
                            <div className="pt-4"><ReliabilityChart data={analysis.timeline} claims={analysis.claims} totalDuration={analysis.summary.totalDuration} /></div>
                        </div>
                    )}

                    {activeTab === 'claims' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="flex items-center gap-3 pb-4 border-b border-[#333]">
                                <SectionIcon id="claims" />
                                <h3 className="text-xl md:text-2xl font-black text-[#C4B091] uppercase tracking-tight">{t('analysis.claimsForVerification')}</h3>
                            </div>
                            {(analysis.claims || []).length === 0 && (
                                <p className="text-[#666] text-sm">{t('analysis.noClaimsTryDeep')}</p>
                            )}
                            {(analysis.claims || []).map((claim, idx) => (
                                <div key={idx} className="editorial-card p-6 md:p-8 space-y-6 border-l-2 border-l-[#968B74]/50">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#333] pb-4">
                                        <span className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest border ${['FALSE', 'MOSTLY_FALSE'].includes(claim.verdict || '') || (claim.veracity || '').toLowerCase().includes('невярно') || (claim.veracity || '').toLowerCase().includes('подвеждащо') ? 'border-[#8b4a4a] text-[#c66] bg-[#8b4a4a]/20' : 'border-[#4a7c59] text-[#7cb87c] bg-[#4a7c59]/20'}`}>{t(getVerdictKey(claim))}</span>
                                        <div className="flex gap-4 text-[8px] font-black uppercase tracking-widest text-[#666]"><span>{t('analysis.category')}: {claim.category}</span><span>{t('analysis.precision')}: {Math.round(claim.confidence * 100)}%</span></div>
                                    </div>
                                    <blockquote className="text-base md:text-xl font-black text-[#E8E8E8] leading-snug  tracking-tight">„{claim.quote}“</blockquote>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                                        <div className="space-y-2"><h5 className="text-[9px] font-black text-[#968B74] uppercase tracking-widest border-b border-[#968B74]/50 pb-0.5 inline-block">{t('analysis.logicalAudit')}</h5><p className="text-[#ccc] leading-[1.6] font-medium">{(claim.explanation === 'Няма налична информация' || claim.explanation === 'No information available') ? t('analysis.noInfoAvailable') : claim.explanation}</p></div>
                                        <div className="space-y-2"><h5 className="text-[9px] font-black text-[#968B74] uppercase tracking-widest border-b border-[#968B74]/50 pb-0.5 inline-block">{t('analysis.context')}</h5><p className="text-[#ccc] leading-[1.6]">{claim.missingContext}</p></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'manipulation' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="pl-6 md:pl-8 border-b border-[#968B74]/30 pb-6 mb-8">
                                <div className="flex items-center gap-3 mb-3">
                                    <SectionIcon id="manipulation" />
                                    <h3 className="text-xl md:text-2xl font-black uppercase text-[#C4B091] tracking-tight">{t('analysis.manipulationDeconstruction')}</h3>
                                </div>
                                <p className="text-sm text-[#C4B091]/90 leading-relaxed">{t('analysis.manipulationIntro')}</p>
                            </div>
                            <div className="grid grid-cols-1 gap-6">
                                {(analysis.manipulations || []).length === 0 && (
                                    <p className="text-[#666] text-sm">{t('analysis.noManipulations')}</p>
                                )}
                                {(analysis.manipulations || []).map((m, idx) => {
                                    const severity = Math.round((m.severity > 1 ? m.severity / 100 : m.severity) * 100);
                                    const getSeverityBorderColor = () => {
                                        if (severity >= 70) return 'border-l-[#8b4a4a]';
                                        if (severity >= 50) return 'border-l-[#a67c52]';
                                        return 'border-l-[#968B74]';
                                    };
                                    const getSeverityTextColor = () => {
                                        if (severity >= 70) return 'text-[#c66]';
                                        if (severity >= 50) return 'text-[#d4a574]';
                                        return 'text-[#C4B091]';
                                    };
                                    return (
                                        <div key={idx} className={`editorial-card p-5 md:p-7 border-l-4 ${getSeverityBorderColor()} hover:border-[#968B74]/30 transition-colors`}>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="space-y-0.5 flex-1">
                                                    <h4 className="text-base md:text-lg font-black text-[#E0E0E0] uppercase tracking-tight">{m.technique}</h4>
                                                    <span className="text-[8px] font-black text-[#968B74] uppercase tracking-widest">{m.timestamp}</span>
                                                </div>
                                                <div className="text-right ml-4">
                                                    <p className="text-[7px] font-black text-[#666] uppercase mb-0.5">{t('analysis.intensity')}</p>
                                                    <span className={`text-lg md:text-xl font-black ${getSeverityTextColor()}`}>{severity}%</span>
                                                </div>
                                            </div>
                                            <div className="bg-[#252525] p-4 mb-4 border border-[#333]">
                                                <p className="text-sm font-bold text-[#ddd] leading-[1.6] whitespace-pre-wrap">{m.logic}</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                                <div>
                                                    <p className="font-black uppercase text-[#C4B091] text-[9px] mb-1 tracking-widest">{t('analysis.audienceImpact')}</p>
                                                    <p className="text-[#ccc] font-medium leading-[1.6]">{m.effect}</p>
                                                </div>
                                                <div>
                                                    <p className="font-black uppercase text-[#7cb87c] text-[9px] mb-1 tracking-widest">{t('analysis.howToProtect')}</p>
                                                    <p className="text-[#ccc] leading-[1.6]">{m.counterArgument || t('analysis.counterArgumentDefault')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'visual' && (
                        <div className="space-y-6 animate-fadeIn">
                            <MultimodalSection title={t('analysis.visualAnalysisTitle')} content={analysis.visualAnalysis} color="indigo" icon={<SectionIcon id="visual" />} />
                        </div>
                    )}
                    {activeTab === 'bodyLanguage' && (
                        <div className="space-y-6 animate-fadeIn">
                            <MultimodalSection title={t('analysis.bodyLanguageTitle')} content={analysis.bodyLanguageAnalysis} color="indigo" icon={<SectionIcon id="bodyLanguage" />} />
                        </div>
                    )}
                    {activeTab === 'vocal' && (
                        <div className="space-y-6 animate-fadeIn">
                            <MultimodalSection title={t('analysis.vocalAnalysisTitle')} content={analysis.vocalAnalysis} color="indigo" icon={<SectionIcon id="vocal" />} />
                        </div>
                    )}
                    {activeTab === 'deception' && (
                        <div className="space-y-6 animate-fadeIn">
                            <MultimodalSection title={t('analysis.deceptionAnalysisTitle')} content={analysis.deceptionAnalysis} color="indigo" icon={<SectionIcon id="deception" />} />
                        </div>
                    )}
                    {activeTab === 'humor' && (
                        <div className="space-y-6 animate-fadeIn">
                            <MultimodalSection title={t('analysis.humorAnalysisTitle')} content={analysis.humorAnalysis} color="indigo" icon={<SectionIcon id="humor" />} />
                        </div>
                    )}
                    {activeTab === 'psychological' && (
                        <div className="space-y-6 animate-fadeIn">
                            <MultimodalSection title={t('analysis.psychologicalTitle')} content={analysis.psychologicalProfile} color="indigo" icon={<SectionIcon id="psychological" />} />
                        </div>
                    )}
                    {activeTab === 'cultural' && (
                        <div className="space-y-6 animate-fadeIn">
                            <MultimodalSection title={t('analysis.culturalAnalysisTitle')} content={analysis.culturalSymbolicAnalysis} color="indigo" icon={<SectionIcon id="cultural" />} />
                        </div>
                    )}

                    {activeTab === 'report' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="p-6 bg-[#252525] border border-[#333] flex justify-between items-center rounded-sm">
                                <h4 className="text-sm font-black uppercase tracking-widest text-[#C4B091] flex items-center gap-2">
                                    <SectionIcon id="report" className="w-4 h-4" /> {t('analysis.fullExpertReport')}
                                </h4>
                                <button onClick={handleSaveFullReport} disabled={isExporting} className="btn-luxury-solid px-6 py-2 text-[9px] tracking-[0.2em] flex items-center gap-2 rounded-sm">
                                    {isExporting ? t('analysis.generating') : t('analysis.downloadPng')}
                                </button>
                            </div>
                            <ReportView analysis={analysis} reportRef={fullReportRef} reportLoading={reportLoading} />
                        </div>
                    )}
                </section>
            </main>
        </div >
    );
};

export default VideoResultView;
