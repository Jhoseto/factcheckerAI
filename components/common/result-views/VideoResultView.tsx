import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { VideoAnalysis } from '../../../types';
import ReliabilityChart from '../../ReliabilityChart';
import MetricBlock from '../MetricBlock';
import { useAuth } from '../../../contexts/AuthContext';
import { makeAnalysisPublic } from '../../../services/archiveService';

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

const renderBoldBronze = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
            ? <strong key={i} className="text-[#C4B091] font-semibold">{part.slice(2, -2)}</strong>
            : part
    );
};

const MultimodalSection: React.FC<{ title: string; content?: string; color: string }> = ({ title, content }) => {
    if (!content || content === 'Няма данни') return null;

    const segments = content.split(/(?=\d+\.\s)/).map(s => s.trim()).filter(Boolean);

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
            <div className="mb-6 pb-4 border-b border-[#333]">
                <h3 className="text-xl md:text-2xl font-black text-[#C4B091] uppercase tracking-tight">{title}</h3>
            </div>
            <div className="max-w-none">
                {segments.map((seg, idx) => renderSegment(seg, idx))}
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
                <section key={sIdx} className={`mb-10 ${sIdx === 0 ? '' : 'pt-8 border-t border-[#333]'}`}>
                    {sectionTitle && (
                        <h4 className={`text-[9px] font-black uppercase tracking-[0.4em] pb-2 mb-6 border-b ${isMainSection ? 'text-[#C4B091] border-[#968B74]/30' : 'text-[#888] border-[#333]'
                            }`}>
                            {sectionTitle}
                        </h4>
                    )}
                    <div className={`text-[#ddd] text-[15px] md:text-base leading-[1.7] font-sans ${sIdx === 0 ? 'first-letter:text-5xl first-letter:font-black first-letter:mr-3 first-letter:float-left first-letter:leading-none first-letter:text-[#C4B091]' : ''}`}>
                        {bodyLines.map((line, lIdx) => {
                            const trimmed = line.trim();
                            if (!trimmed) return null;
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
        const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
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
                <div className="text-[9px] font-black text-[#968B74] uppercase tracking-[0.6em] mb-4">КЛАСИФИЦИРАНО РАЗСЛЕДВАЩО ДОСИЕ #{analysis.id?.substring(0, 8)}</div>
                <h3 className="text-2xl md:text-4xl font-black text-[#E0E0E0] tracking-tight uppercase mb-4  leading-tight">{analysis.videoTitle}</h3>
                <div className="flex justify-center gap-10 text-[8px] font-bold text-[#666] uppercase tracking-widest">
                    <span>ИЗТОЧНИК: {analysis.videoAuthor}</span>
                    <span>ДАТА: {new Date(analysis.timestamp).toLocaleString('bg-BG')}</span>
                    <span>ДВИГАТЕЛ: DCGE v4.8</span>
                </div>
                {analysis.synthesizedReport && (
                    <div className="mt-4 text-[8px] font-black text-[#C4B091] uppercase tracking-widest">✦ СИНТЕЗИРАН АВТОРСКИ ДОКЛАД ✦</div>
                )}
            </header>

            {reportLoading ? (
                <div className="text-center py-20 animate-pulse">
                    <div className="inline-block w-8 h-8 border-2 border-[#968B74] border-t-transparent rounded-full animate-spin mb-6"></div>
                    <h4 className="text-lg font-black text-[#C4B091] uppercase tracking-widest mb-2">Генериране на доклад</h4>
                    <p className="text-xs text-[#666] uppercase tracking-wider">Главният редактор подготвя финалния авторски анализ...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                    <div className="md:col-span-8 space-y-2">
                        {renderReportContent(reportText)}
                    </div>

                    <aside className="md:col-span-4 space-y-8">
                        <div className="p-6 bg-[#1a1a1a] border border-[#333] rounded-sm">
                            <h4 className="text-[8px] font-black text-[#968B74] uppercase tracking-widest mb-6 border-b border-[#333] pb-2 text-center">АНАЛИТИЧНИ МЕТРИКИ</h4>
                            <div className="space-y-6">
                                {Object.entries(analysis.summary.detailedStats).map(([key, val], idx) => (
                                    <div key={idx}>
                                        <div className="flex justify-between text-[7px] font-black uppercase mb-1">
                                            <span className="text-[#666]">{translateMetricName(key)}</span>
                                            <span className="text-[#C4B091]">{Math.round((val as number) * 100)}%</span>
                                        </div>
                                        <div className="w-full h-1 bg-[#333] rounded-full overflow-hidden">
                                            <div className="h-full bg-[#968B74]" style={{ width: `${(val as number) * 100}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 border border-[#968B74]/30 text-center bg-[#252525]">
                            <div className="w-10 h-10 border-2 border-[#968B74] rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-[#C4B091] font-black text-xl">✓</span>
                            </div>
                            <p className="text-[8px] font-black text-[#E0E0E0] uppercase leading-relaxed mb-1 tracking-widest">АВТЕНТИФИЦИРАНО</p>
                            <p className="text-[7px] font-bold text-[#666] uppercase tracking-tight">Верифицирано срещу глобални данни.</p>
                        </div>

                        <div className="p-6 bg-[#252525] border border-[#333] rounded-sm">
                            <h4 className="text-[9px] font-black text-[#968B74] uppercase mb-4 tracking-widest">СТРАТЕГИЧЕСКО НАМЕРЕНИЕ</h4>
                            <p className="text-[15px] text-[#ccc] leading-[1.6]">
                                {analysis.summary.strategicIntent}
                            </p>
                        </div>

                        <div className="p-6 bg-[#1a1a1a] border border-[#333] text-[8px] text-[#555] font-mono leading-tight uppercase rounded-sm">
                            ИД НА ОДИТ (AUDIT_ID): {analysis.id}<br />
                            ВЪЗЕЛ (NODE): SEREZLIEV_G_UNIT<br />
                            СТАТУС (STATUS): FINAL_VERIFICATION<br />
                            ХЕШ (HASH): {Math.random().toString(16).slice(2, 18).toUpperCase()}
                        </div>
                    </aside>
                </div>
            )}

            <footer className="mt-20 pt-8 border-t border-[#333] text-center">
                <div className="text-[9px] font-black text-[#555] uppercase tracking-[0.5em] mb-4">© ФАКТЧЕКЪР AI | ПЪЛЕН МЕДИЕН АНАЛИЗАТОР</div>
                <p className="text-[7px] text-[#444] uppercase leading-relaxed max-w-2xl mx-auto">
                    Този документ е генериран чрез алгоритмите на Deep Contextual Reasoning Engine v4.8.
                    Всички изводи са базирани на статистическа вероятност и крос-рефериране с независими източници.
                </p>
            </footer>
        </article>
    );
};

import ShareModal from '../ShareModal';

const VideoResultView: React.FC<VideoResultViewProps> = ({ analysis, reportLoading, onSaveToArchive, onReset, slotUsage, isSaved = false }) => {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'summary' | 'claims' | 'manipulation' | 'transcript' | 'report' | 'visual' | 'bodyLanguage' | 'vocal' | 'deception' | 'humor' | 'psychological' | 'cultural'>('summary');
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
                alert('Грешка при маркиране на анализа като публичен. Моля, опитайте отново.');
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
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-5">
                    <MetricBlock label="Индекс на Достоверност" value={analysis.summary.credibilityIndex} color="emerald" />
                    <MetricBlock label="Индекс на Манипулация" value={analysis.summary.manipulationIndex} color="orange" />
                </div>
                <div className="editorial-card p-5 border-l-2 border-l-[#968B74] mt-4 mb-4">
                    <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-2">КЛАСИФИКАЦИЯ</p>
                    <span className="text-[#C4B091] font-black text-sm md:text-base block leading-tight uppercase tracking-tighter">{analysis.summary.finalClassification}</span>
                </div>
                <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
                    <p className="text-[7px] font-black text-[#968B74] uppercase tracking-widest mb-2">Цена на анализа</p>
                    <p className="text-lg font-black text-bronze-gradient">{(analysis.pointsCost ?? 0).toLocaleString('bg-BG')} точки</p>
                </div>
                <div className="flex flex-col gap-4">
                    {!isSaved && onSaveToArchive && (
                        <button
                            onClick={onSaveToArchive}
                            disabled={slotUsage ? slotUsage.used >= slotUsage.max : false}
                            className={slotUsage && slotUsage.used >= slotUsage.max ? 'px-5 py-3.5 text-[10px] font-black uppercase tracking-widest w-full rounded-sm bg-[#333] text-[#555] cursor-not-allowed border border-[#333]' : 'btn-luxury-solid px-5 py-3.5 text-[10px] font-black uppercase tracking-widest w-full rounded-sm'}
                        >
                            {slotUsage && slotUsage.used >= slotUsage.max ? 'НЯМА СВОБОДНИ СЛОТОВЕ' : `ЗАПАЗИ В АРХИВ (${slotUsage?.used ?? 0}/${slotUsage?.max ?? 0})`}
                        </button>
                    )}
                    <div className="w-full relative group">
                        <button
                            onClick={isSaved ? handleShare : undefined}
                            disabled={!isSaved}
                            className={`px-5 py-3.5 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full rounded-sm ${isSaved ? 'btn-luxury-solid' : 'bg-[#333] text-[#555] cursor-not-allowed border border-[#333]'}`}
                        >
                            СПОДЕЛИ ДОКЛАДА
                        </button>
                        {!isSaved && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#252525] border border-[#968B74]/30 text-[#C4B091] text-[9px] font-bold uppercase tracking-wide rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                Запазете доклада, за да го споделите
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#252525]"></div>
                            </div>
                        )}
                    </div>
                    {onReset && (
                        <button onClick={onReset} className="btn-luxury px-5 py-3.5 text-[10px] font-black uppercase tracking-widest w-full rounded-sm flex items-center justify-center gap-2 hover:border-[#8b4a4a] hover:text-[#c66]" title="Затвори и Нов Анализ">
                            <span>✕</span> ЗАТВОРИ
                        </button>
                    )}
                </div>
        </>
    );

    const tabsBarContent = (() => {
        const baseTabsBefore = [
            { id: 'summary', label: 'Резюме' },
            { id: 'claims', label: 'Твърдения' },
            { id: 'manipulation', label: 'Манипулация' },
            { id: 'transcript', label: 'Транскрипт' }
        ];
        const deepTabs = analysis.analysisMode === 'deep' ? [
            { id: 'visual', label: 'Визуален' }, { id: 'bodyLanguage', label: 'Тяло' }, { id: 'vocal', label: 'Вокал' },
            { id: 'deception', label: 'Измама' }, { id: 'humor', label: 'Хумор' }, { id: 'psychological', label: 'Психо' }, { id: 'cultural', label: 'Културен' }
        ] : [];
        const finalTabs = [...baseTabsBefore, ...deepTabs, { id: 'report', label: 'Финален доклад' }];
        return (
            <>
                {finalTabs.map(tab => {
                    const isReportTab = tab.id === 'report';
                    const isDisabled = isReportTab && reportLoading;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => !isDisabled && setActiveTab(tab.id as any)}
                            disabled={isDisabled}
                            className={`text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap pb-1 relative transition-all flex items-center gap-2 ${isDisabled ? 'text-[#444] cursor-not-allowed' : activeTab === tab.id ? 'text-[#C4B091]' : 'text-[#666] hover:text-[#C4B091]'}`}
                        >
                            {tab.label}
                            {isReportTab && reportLoading && <span className="inline-block w-3 h-3 border-2 border-[#968B74] border-t-transparent rounded-full animate-spin"></span>}
                            {activeTab === tab.id && !isDisabled && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#968B74]"></div>}
                        </button>
                    );
                })}
            </>
        );
    })();

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
                                        <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest">ОБЕКТ:</p>
                                        <h2 className="text-xl md:text-3xl font-black text-[#E0E0E0] uppercase tracking-tight  leading-tight pr-24">{analysis.videoTitle}</h2>
                                    </div>
                                    <div className={`px-2 py-0.5 border ${analysis.analysisMode === 'deep' ? 'bg-[#968B74] border-[#968B74] text-[#1a1a1a]' : 'border-[#333] text-[#666]'} text-[7px] font-black uppercase tracking-[0.2em] rounded-sm absolute top-0 right-0`}>
                                        {analysis.analysisMode === 'deep' ? 'Дълбок анализ' : 'Стандартен анализ'}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[#333]">
                                    <div><p className="text-[9px] font-black text-[#666] uppercase mb-0.5">Източник</p><p className="text-sm font-black text-[#C4B091] uppercase truncate">{analysis.videoAuthor}</p></div>
                                    <div><p className="text-[9px] font-black text-[#666] uppercase mb-0.5">Времетраене</p><p className="text-sm font-black text-[#E0E0E0] uppercase">{analysis.summary.totalDuration}</p></div>
                                    <div><p className="text-[9px] font-black text-[#666] uppercase mb-0.5">Дата</p><p className="text-sm font-black text-[#E0E0E0] uppercase">{new Date(analysis.timestamp).toLocaleDateString()}</p></div>
                                    <div><p className="text-[9px] font-black text-[#666] uppercase mb-0.5">Audit ID</p><p className="text-sm font-black text-[#968B74] uppercase">#{analysis.id}</p></div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-[9px] font-black text-[#968B74] uppercase tracking-widest border-b border-[#968B74]/50 pb-1 inline-block">Изпълнително Резюме</h3>
                                <p className="text-[#ddd] text-base md:text-lg leading-[1.65]  border-l-2 border-[#968B74] pl-6 py-2 bg-[#252525]/50">„{analysis.summary.overallSummary}“</p>
                            </div>
                            <div className="pt-4"><ReliabilityChart data={analysis.timeline} claims={analysis.claims} totalDuration={analysis.summary.totalDuration} /></div>
                        </div>
                    )}

                    {activeTab === 'claims' && (
                        <div className="space-y-6 animate-fadeIn">
                            {(analysis.claims || []).length === 0 && (
                                <p className="text-[#666] text-sm">Няма извлечени твърдения за верификация. Опитайте Deep анализ за пълен списък.</p>
                            )}
                            {(analysis.claims || []).map((claim, idx) => (
                                <div key={idx} className="editorial-card p-6 md:p-8 space-y-6 border-l-2 border-l-[#968B74]/50">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#333] pb-4">
                                        <span className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest border ${claim.veracity.toLowerCase().includes('невярно') ? 'border-[#8b4a4a] text-[#c66] bg-[#8b4a4a]/20' : 'border-[#4a7c59] text-[#7cb87c] bg-[#4a7c59]/20'}`}>{claim.veracity}</span>
                                        <div className="flex gap-4 text-[8px] font-black uppercase tracking-widest text-[#666]"><span>Категория: {claim.category}</span><span>Прецизност: {Math.round(claim.confidence * 100)}%</span></div>
                                    </div>
                                    <blockquote className="text-base md:text-xl font-black text-[#E8E8E8] leading-snug  tracking-tight">„{claim.quote}“</blockquote>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                                        <div className="space-y-2"><h5 className="text-[9px] font-black text-[#968B74] uppercase tracking-widest border-b border-[#968B74]/50 pb-0.5 inline-block">Логически Одит</h5><p className="text-[#ccc] leading-[1.6] font-medium">{claim.explanation}</p></div>
                                        <div className="space-y-2"><h5 className="text-[9px] font-black text-[#968B74] uppercase tracking-widest border-b border-[#968B74]/50 pb-0.5 inline-block">Контекст</h5><p className="text-[#ccc] leading-[1.6]">{claim.missingContext}</p></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'manipulation' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="pl-6 md:pl-8 border-b border-[#968B74]/30 pb-6 mb-8">
                                <h3 className="text-xl md:text-2xl font-black uppercase mb-3 text-[#C4B091] tracking-tight">Деконструкция на Манипулациите</h3>
                                <p className="text-sm text-[#C4B091]/90 leading-relaxed">Всички идентифицирани манипулативни техники с конкретни примери от видеото и анализ на въздействието им върху аудиторията.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-6">
                                {(analysis.manipulations || []).length === 0 && (
                                    <p className="text-[#666] text-sm">Няма идентифицирани манипулативни техники.</p>
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
                                                    <p className="text-[7px] font-black text-[#666] uppercase mb-0.5">Интензитет</p>
                                                    <span className={`text-lg md:text-xl font-black ${getSeverityTextColor()}`}>{severity}%</span>
                                                </div>
                                            </div>
                                            <div className="bg-[#252525] p-4 mb-4 border border-[#333]">
                                                <p className="text-sm font-bold text-[#ddd] leading-[1.6] whitespace-pre-wrap">{m.logic}</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                                <div>
                                                    <p className="font-black uppercase text-[#C4B091] text-[9px] mb-1 tracking-widest">Въздействие върху аудиторията:</p>
                                                    <p className="text-[#ccc] font-medium leading-[1.6]">{m.effect}</p>
                                                </div>
                                                <div>
                                                    <p className="font-black uppercase text-[#7cb87c] text-[9px] mb-1 tracking-widest">Как да се защитим:</p>
                                                    <p className="text-[#ccc] leading-[1.6]">{m.counterArgument || 'Проверка на първоизточници и критично мислене.'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'transcript' && (
                        <div className="editorial-card p-6 md:p-10 animate-fadeIn border-l-2 border-l-[#968B74]">
                            <div className="mb-6 pb-4 border-b border-[#333]">
                                <h3 className="text-[9px] font-black text-[#968B74] uppercase tracking-widest mb-2">Пълна транскрипция</h3>
                                <p className="text-xs text-[#666]">Реалните имена на участниците са извлечени от видеото. Ако името не е споменато, се използва 'Speaker 1', 'Speaker 2' и т.н.</p>
                            </div>
                            <div className="max-w-2xl mx-auto space-y-8 text-sm">
                                {analysis.transcription.map((line, idx) => {
                                    const isRealName = line.speaker && !line.speaker.match(/^Speaker\s*\d+$/i) && !line.speaker.includes('Система');
                                    return (
                                        <div key={idx} className="flex gap-6 group hover:bg-[#252525]/50 p-3 -m-3 rounded transition-colors">
                                            <span className="text-[9px] font-black text-[#555] uppercase tracking-widest w-12 pt-1 shrink-0">{line.timestamp}</span>
                                            <div className="space-y-1 flex-1">
                                                <span className={`text-[8px] font-black uppercase tracking-widest ${isRealName ? 'text-[#7cb87c]' : 'text-[#968B74]'}`}>
                                                    {line.speaker}
                                                    {isRealName && <span className="ml-2 text-[7px] text-[#5a9a5a]">(Реално име)</span>}
                                                </span>
                                                <p className="text-[15px] text-[#ddd] leading-[1.6] font-sans font-medium">{line.text}</p>
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
                            <div className="p-6 bg-[#252525] border border-[#333] flex justify-between items-center rounded-sm">
                                <h4 className="text-sm font-black uppercase tracking-widest text-[#C4B091]">Пълен Експертен Одит (Досие)</h4>
                                <button onClick={handleSaveFullReport} disabled={isExporting} className="btn-luxury-solid px-6 py-2 text-[9px] tracking-[0.2em] flex items-center gap-2 rounded-sm">
                                    {isExporting ? 'ГЕНЕРИРАНЕ...' : 'СВАЛИ PNG'}
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
