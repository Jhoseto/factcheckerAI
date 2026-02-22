import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { VideoAnalysis } from '../../../types';
import MetricBlock from '../MetricBlock';
import ReliabilityGauge from '../../linkAudit/ReliabilityGauge';
import { useAuth } from '../../../contexts/AuthContext';
import { makeAnalysisPublic } from '../../../services/archiveService';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface LinkResultViewProps {
    analysis: VideoAnalysis;
    url: string;
    price: number;
    onSave?: () => void;
    onReset?: () => void;
    slotUsage?: { used: number, max: number };
    isSaved?: boolean;
}

import ShareModal from '../ShareModal';

const LinkResultView: React.FC<LinkResultViewProps> = ({ analysis, url, price, onSave, onReset, slotUsage, isSaved = false }) => {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'summary' | 'claims' | 'manipulation' | 'profile' | 'rhetoric' | 'comments' | 'report'>('summary');
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

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

    const isFull = slotUsage && slotUsage.used >= slotUsage.max;

    const linkSidebarContent = (
        <>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-5">
                <MetricBlock label="Фактическа Точност" value={analysis.summary.detailedStats.factualAccuracy} color="emerald" />
                <MetricBlock label="Логическа Стройност" value={analysis.summary.detailedStats.logicalSoundness} color="blue" />
                <MetricBlock label="Емоционална Окраска" value={analysis.summary.detailedStats.emotionalBias} color="orange" />
                <MetricBlock label="Пропаганден Индекс" value={analysis.summary.detailedStats.propagandaScore} color="red" />
            </div>
            <div className="editorial-card p-5 border-l-2 border-l-[#968B74] mt-4 mb-4">
                <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-2">КЛАСИФИКАЦИЯ</p>
                <span className={`font-black text-sm md:text-base block leading-tight uppercase tracking-tighter ${analysis.summary.finalClassification === 'ACCURATE' ? 'text-[#7cb87c]' : analysis.summary.finalClassification === 'MISLEADING' ? 'text-[#d4a574]' : analysis.summary.finalClassification === 'FALSE' ? 'text-[#c66]' : 'text-[#C4B091]'}`}>
                    {analysis.summary.finalClassification === 'ACCURATE' ? 'ДОСТОВЕРНО' : analysis.summary.finalClassification === 'MOSTLY_ACCURATE' ? 'ПРЕДИМНО ТОЧНО' : analysis.summary.finalClassification === 'MIXED' ? 'СМЕСЕНИ ДАННИ' : analysis.summary.finalClassification === 'MISLEADING' ? 'ПОДВЕЖДАЩО' : 'НЕВЯРНО'}
                </span>
            </div>
            <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
                <p className="text-[7px] font-black text-[#968B74] uppercase tracking-widest mb-2">Цена на анализа</p>
                <p className="text-lg font-black text-bronze-gradient">{price} точки</p>
            </div>
            <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
                <p className="text-[7px] font-black text-[#666] uppercase tracking-widest mb-2">Източник</p>
                <p className="text-xs font-black text-[#C4B091] truncate">{(() => { try { return new URL(url).hostname; } catch { return url || 'Неизвестен източник'; } })()}</p>
            </div>
            <div className="flex flex-col gap-4">
                {!isSaved && onSave && (
                    <button onClick={onSave} disabled={isFull} className={`px-5 py-3.5 text-[10px] font-black uppercase tracking-widest w-full rounded-sm ${isFull ? 'bg-[#333] text-[#555] cursor-not-allowed border border-[#333]' : 'btn-luxury-solid'}`} title={isFull ? 'Достигнали сте лимита за този тип анализи' : 'Запази в архив'}>
                        {isFull ? 'НЯМА СВОБОДНИ СЛОТОВЕ' : `ЗАПАЗИ В АРХИВ (${slotUsage?.used ?? 0}/${slotUsage?.max ?? 0})`}
                    </button>
                )}
                <div className="w-full relative group">
                    <button onClick={isSaved ? handleShare : undefined} disabled={!isSaved} className={`px-5 py-3.5 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full rounded-sm ${isSaved ? 'btn-luxury-solid cursor-pointer' : 'bg-[#333] text-[#555] cursor-not-allowed border border-[#333]'}`}>
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

    const hasComments = !!analysis.commentsAnalysis?.found;

    const TABS = [
        { id: 'summary', label: 'Резюме' },
        { id: 'claims', label: 'Верификация' },
        { id: 'manipulation', label: 'Манипулация' },
        { id: 'profile', label: 'Профил' },
        { id: 'rhetoric', label: 'Реторика' },
        { id: 'comments', label: 'Коментари' },
        { id: 'report', label: 'Финален Доклад' },
    ] as const;

    const linkTabsContent = (
        <>
            {TABS.map(({ id, label }) => (
                <button key={id} onClick={() => setActiveTab(id)} className={`text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap pb-1 relative transition-all flex items-center gap-2 ${activeTab === id ? 'text-[#C4B091]' : 'text-[#666] hover:text-[#C4B091]'}`}>
                    {label}
                    {id === 'comments' && hasComments && <span className="w-1.5 h-1.5 rounded-full bg-[#C4B091] inline-block" />}
                    {activeTab === id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#968B74]"></div>}
                </button>
            ))}
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
                                {linkTabsContent}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {createPortal(
                <aside className="hidden lg:block fixed top-32 left-[max(2.5rem,calc(50%-800px+2.5rem))] w-[min(380px,calc((100vw-5rem)*3/12))] max-h-[calc(100vh-8rem)] overflow-y-auto z-[90] py-6 pl-5 pr-4 print:hidden bg-[#1a1a1a]/95 backdrop-blur-md flex flex-col gap-8">
                    {linkSidebarContent}
                </aside>,
                document.body
            )}
            <div className="hidden lg:block lg:col-span-3" aria-hidden />
            <aside className="lg:hidden col-span-1 lg:col-span-3 print:hidden flex flex-col gap-8 px-4 py-5">
                {linkSidebarContent}
            </aside>

            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                shareUrl={analysis.id ? `${window.location.origin}/report/${analysis.id}` : ''}
            />

            {/* Main Content */}
            <main className="lg:col-span-9 space-y-0">
                <nav className="lg:hidden border-b border-[#333] bg-[#1a1a1a] py-4 px-4 print:hidden">
                    <div className="flex flex-wrap gap-x-6 gap-y-2">{linkTabsContent}</div>
                </nav>
                <div className="h-[52px]" aria-hidden />
                <section className="min-h-[400px] pt-2 pb-8">
                    {activeTab === 'summary' && (
                        <div className="space-y-10 animate-fadeIn">
                            {/* Header Card */}
                            <div className="editorial-card p-6 md:p-8 border-l-4 border-l-[#968B74] space-y-4">
                                <div className="flex flex-col md:flex-row gap-8 items-center">
                                    <div className="flex-shrink-0 w-32 h-32 md:w-40 md:h-40">
                                        <ReliabilityGauge score={analysis.summary.detailedStats.factualAccuracy} />
                                    </div>
                                    <div className="space-y-2 flex-1 text-center md:text-left">
                                        <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest">Дълбок Анализ на Текст</p>
                                        <h2 className="text-xl md:text-3xl font-black text-[#E0E0E0] uppercase tracking-tight leading-tight">{analysis.videoTitle}</h2>
                                        <div className="pt-2">
                                            <span className={`px-3 py-1 text-[10px] font-black text-[#1a1a1a] uppercase tracking-widest inline-block rounded-sm
                                                ${analysis.summary.finalClassification === 'ACCURATE' ? 'bg-[#4a7c59]' :
                                                    analysis.summary.finalClassification === 'MOSTLY_ACCURATE' ? 'bg-[#5a9a5a]' :
                                                        analysis.summary.finalClassification === 'MIXED' ? 'bg-[#968B74]' :
                                                            analysis.summary.finalClassification === 'MISLEADING' ? 'bg-[#a67c52]' : 'bg-[#8b4a4a]'}`}>
                                                {analysis.summary.finalClassification === 'ACCURATE' ? 'Достоверно' :
                                                    analysis.summary.finalClassification === 'MOSTLY_ACCURATE' ? 'Предимно точно' :
                                                        analysis.summary.finalClassification === 'MIXED' ? 'Смесени данни' :
                                                            analysis.summary.finalClassification === 'MISLEADING' ? 'Подвеждащо' : 'Невярно'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-[9px] font-black text-[#968B74] uppercase tracking-widest border-b border-[#968B74]/50 pb-1 inline-block">Изпълнително Резюме</h3>
                                <p className="text-[#ddd] text-base md:text-lg leading-[1.65] border-l-2 border-[#968B74] pl-6 py-2 bg-[#252525]/50">
                                    „{analysis.summary.overallSummary}“
                                </p>
                            </div>

                            <div className="editorial-card p-8 space-y-4 border-l-4 border-l-[#968B74]">
                                <h3 className="text-[9px] font-black text-[#968B74] uppercase tracking-widest border-b border-[#968B74]/50 pb-1 inline-block">Стратегически Препоръки</h3>
                                <p className="text-[#ccc] text-[15px] leading-[1.65] font-medium whitespace-pre-wrap">
                                    {Array.isArray(analysis.summary.recommendations)
                                        ? (analysis.summary.recommendations as any[]).map((r: any, i: number) => (
                                            <span key={i} className="block">{typeof r === 'string' ? r : `${r.title || ''} — ${r.url || ''}`}</span>
                                        ))
                                        : analysis.summary.recommendations}
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'claims' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="p-4 bg-[#252525] border border-[#333] rounded-sm text-center">
                                <p className="text-[8px] font-black text-[#666] uppercase tracking-widest">
                                    Открити са {analysis.claims.length} твърдения за проверка
                                </p>
                            </div>

                            {analysis.claims.map((claim, idx) => (
                                <div key={idx} className="editorial-card p-6 md:p-8 space-y-6 border-l-2 border-l-[#968B74]/50">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#333] pb-4">
                                        <span className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest border ${claim.veracity.toLowerCase().includes('невярно') ? 'border-[#8b4a4a] text-[#c66] bg-[#8b4a4a]/20' : 'border-[#4a7c59] text-[#7cb87c] bg-[#4a7c59]/20'}`}>{claim.veracity}</span>
                                        <div className="text-[8px] font-black uppercase tracking-widest text-[#666]">Твърдение #{idx + 1}</div>
                                    </div>
                                    <blockquote className="text-base md:text-xl font-black text-[#E8E8E8] leading-snug  tracking-tight">„{claim.quote}“</blockquote>
                                    <div className="p-4 bg-[#252525] border-l-4 border-[#333]">
                                        <h5 className="text-[9px] font-black text-[#968B74] uppercase tracking-widest mb-1">Анализ на фактите</h5>
                                        <p className="text-[#ccc] leading-[1.6] font-medium text-[15px]">{claim.explanation}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'manipulation' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="pl-6 md:pl-8 border-b border-[#968B74]/30 pb-6 mb-8">
                                <h3 className="text-xl md:text-2xl font-black uppercase mb-3 text-[#C4B091] tracking-tight">Деконструкция на Манипулациите</h3>
                                <p className="text-sm text-[#C4B091]/90 leading-relaxed">Идентифицирани манипулативни техники с анализ на въздействието върху аудиторията.</p>
                            </div>

                            {/* Radar chart */}
                            {analysis.manipulations.length > 1 && (() => {
                                const radarData = analysis.manipulations.map(m => ({
                                    subject: m.technique.length > 18 ? m.technique.slice(0, 18) + '…' : m.technique,
                                    value: Math.round((m.severity > 1 ? m.severity / 100 : m.severity) * 100)
                                }));
                                return (
                                    <div className="editorial-card p-6 border border-[#968B74]/20">
                                        <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest mb-4">Радар на манипулациите</p>
                                        <ResponsiveContainer width="100%" height={260}>
                                            <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                                                <PolarGrid stroke="#333" />
                                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 9, fontWeight: 700 }} />
                                                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 2, fontSize: 10 }} formatter={(v: number) => [`${v}%`, 'Интензитет']} />
                                                <Radar dataKey="value" stroke="#C4B091" fill="#C4B091" fillOpacity={0.15} strokeWidth={1.5} />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                );
                            })()}

                            {analysis.manipulations.map((tech, idx) => (
                                <div key={idx} className="editorial-card p-6 md:p-8 space-y-4 border-l-4 hover:border-[#968B74]/40 transition-colors"
                                    style={{ borderLeftColor: tech.severity > 0.7 ? '#8b4a4a' : tech.severity > 0.4 ? '#a67c52' : '#968B74' }}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="text-lg font-black text-[#E0E0E0] uppercase tracking-tight">{tech.technique}</h4>
                                            {tech.counterArgument && (
                                                <p className="text-[8px] text-[#555] mt-0.5" title={`Контра-аргумент: ${tech.counterArgument}`}>ℹ Hover за контра-аргумент</p>
                                            )}
                                        </div>
                                        <div className="flex-shrink-0 bg-[#252525] px-3 py-1 rounded-full border border-[#333]">
                                            <span className="text-[9px] font-black text-[#968B74] uppercase tracking-widest">Тежест: {Math.round((tech.severity > 1 ? tech.severity / 100 : tech.severity) * 100)}%</span>
                                        </div>
                                    </div>
                                    <p className="text-[15px] text-[#ccc] leading-[1.6] font-medium">{tech.logic}</p>
                                    {tech.effect && (
                                        <div className="mt-4 p-4 bg-[#252525] border-l-2 border-[#968B74]/30">
                                            <p className="text-[9px] font-black text-[#C4B091] uppercase tracking-widest mb-1">Въздействие върху аудиторията:</p>
                                            <p className="text-sm font-bold text-[#ddd]">{tech.effect}</p>
                                        </div>
                                    )}
                                    {tech.counterArgument && (
                                        <div className="p-3 bg-[#1e2a1e] border-l-2 border-[#4a7c59]">
                                            <p className="text-[9px] font-black text-[#7cb87c] uppercase tracking-widest mb-1">Рационален отговор:</p>
                                            <p className="text-xs text-[#aaa]">{tech.counterArgument}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'profile' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="pl-6 md:pl-8 border-b border-[#968B74]/30 pb-6 mb-8">
                                <h3 className="text-xl md:text-2xl font-black uppercase mb-3 text-[#C4B091] tracking-tight">Профил на Автора и Медията</h3>
                                <p className="text-sm text-[#C4B091]/90 leading-relaxed">Контекст за доверието в источника.</p>
                            </div>

                            {/* Author */}
                            {analysis.authorProfile && (
                                <div className="editorial-card p-6 md:p-8 space-y-4 border-l-4 border-l-[#968B74]">
                                    <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest">Автор</p>
                                    {analysis.authorProfile.name && <h4 className="text-lg font-black text-[#E0E0E0]">{analysis.authorProfile.name}</h4>}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        {analysis.authorProfile.knownBias && (
                                            <div><p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-1">Известна пристрастност</p><p className="text-[#ccc]">{analysis.authorProfile.knownBias}</p></div>
                                        )}
                                        {analysis.authorProfile.credibilityNote && (
                                            <div><p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-1">Надеждност</p><p className="text-[#ccc]">{analysis.authorProfile.credibilityNote}</p></div>
                                        )}
                                    </div>
                                    {analysis.authorProfile.affiliations && analysis.authorProfile.affiliations.length > 0 && (
                                        <div>
                                            <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-2">Афилиации</p>
                                            <div className="flex flex-wrap gap-2">{analysis.authorProfile.affiliations.map((a, i) => <span key={i} className="px-2 py-0.5 text-[9px] font-bold text-[#C4B091] border border-[#968B74]/30 bg-[#252525]">{a}</span>)}</div>
                                        </div>
                                    )}
                                    {analysis.authorProfile.typicalTopics && analysis.authorProfile.typicalTopics.length > 0 && (
                                        <div>
                                            <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-2">Типични теми</p>
                                            <div className="flex flex-wrap gap-2">{analysis.authorProfile.typicalTopics.map((t, i) => <span key={i} className="px-2 py-0.5 text-[9px] font-bold text-[#888] border border-[#333] bg-[#1a1a1a]">{t}</span>)}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Media */}
                            {analysis.mediaProfile && (
                                <div className="editorial-card p-6 md:p-8 space-y-4 border-l-4 border-l-[#968B74]">
                                    <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest">Медиен Профил</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {analysis.mediaProfile.politicalLean && (
                                            <div className="editorial-card p-4 text-center">
                                                <p className="text-[7px] font-black text-[#666] uppercase tracking-widest mb-1">Ориентация</p>
                                                <p className="text-sm font-black text-[#C4B091] uppercase">{analysis.mediaProfile.politicalLean}</p>
                                            </div>
                                        )}
                                        {analysis.mediaProfile.reliabilityRating !== undefined && (
                                            <div className="editorial-card p-4 text-center">
                                                <p className="text-[7px] font-black text-[#666] uppercase tracking-widest mb-1">Надеждност</p>
                                                <p className={`text-2xl font-black ${analysis.mediaProfile.reliabilityRating >= 0.7 ? 'text-[#7cb87c]' : analysis.mediaProfile.reliabilityRating >= 0.4 ? 'text-[#d4a574]' : 'text-[#c66]'}`}>{Math.round(analysis.mediaProfile.reliabilityRating * 100)}%</p>
                                            </div>
                                        )}
                                        {analysis.mediaProfile.ownership && (
                                            <div className="editorial-card p-4">
                                                <p className="text-[7px] font-black text-[#666] uppercase tracking-widest mb-1">Собственост</p>
                                                <p className="text-xs font-bold text-[#ccc]">{analysis.mediaProfile.ownership}</p>
                                            </div>
                                        )}
                                        {analysis.mediaProfile.fundingSource && (
                                            <div className="editorial-card p-4">
                                                <p className="text-[7px] font-black text-[#666] uppercase tracking-widest mb-1">Финансиране</p>
                                                <p className="text-xs font-bold text-[#ccc]">{analysis.mediaProfile.fundingSource}</p>
                                            </div>
                                        )}
                                    </div>
                                    {analysis.mediaProfile.knownFor && (
                                        <div className="p-4 bg-[#252525] border-l-2 border-[#968B74]/30">
                                            <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-1">Известна с</p>
                                            <p className="text-sm text-[#ccc]">{analysis.mediaProfile.knownFor}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Timing + Freshness */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {analysis.timingAnalysis && (
                                    <div className="editorial-card p-6 space-y-2 border-l-4 border-l-[#a67c52]">
                                        <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest">Защо точно сега?</p>
                                        <p className="text-sm text-[#ccc] leading-[1.6]">{analysis.timingAnalysis}</p>
                                    </div>
                                )}
                                {analysis.freshnessCheck && (
                                    <div className="editorial-card p-6 space-y-2 border-l-4 border-l-[#4a7c59]">
                                        <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest">Свежест на информацията</p>
                                        <p className="text-sm text-[#ccc] leading-[1.6]">{analysis.freshnessCheck}</p>
                                    </div>
                                )}
                            </div>

                            {(!analysis.authorProfile && !analysis.mediaProfile && !analysis.timingAnalysis) && (
                                <div className="editorial-card p-10 text-center border border-dashed border-[#333]">
                                    <p className="text-[#555] text-sm">Профилна информация не е налична за тази статия.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'rhetoric' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="pl-6 md:pl-8 border-b border-[#968B74]/30 pb-6 mb-8">
                                <h3 className="text-xl md:text-2xl font-black uppercase mb-3 text-[#C4B091] tracking-tight">Реторичен Анализ</h3>
                                <p className="text-sm text-[#C4B091]/90 leading-relaxed">Езикови техники, емоционални тригери и структура на разказа.</p>
                            </div>

                            {/* Headline analysis */}
                            {analysis.headlineAnalysis && (
                                <div className={`editorial-card p-6 md:p-8 space-y-4 border-l-4 ${analysis.headlineAnalysis.isClickbait ? 'border-l-[#8b4a4a]' : 'border-l-[#4a7c59]'}`}>
                                    <div className="flex justify-between items-center">
                                        <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest">Анализ на заглавието</p>
                                        <div className="flex gap-3 items-center">
                                            <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest border ${analysis.headlineAnalysis.isClickbait ? 'border-[#8b4a4a] text-[#c66] bg-[#8b4a4a]/20' : 'border-[#4a7c59] text-[#7cb87c] bg-[#4a7c59]/20'}`}>
                                                {analysis.headlineAnalysis.isClickbait ? 'Кликбейт' : 'Честно заглавие'}
                                            </span>
                                            <span className="text-[8px] font-black text-[#666] uppercase">Съответствие: {Math.round(analysis.headlineAnalysis.matchScore * 100)}%</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-[#ccc] leading-[1.6]">{analysis.headlineAnalysis.explanation}</p>
                                    {analysis.headlineAnalysis.sensationalWords && analysis.headlineAnalysis.sensationalWords.length > 0 && (
                                        <div>
                                            <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-2">Сензационни думи</p>
                                            <div className="flex flex-wrap gap-2">{analysis.headlineAnalysis.sensationalWords.map((w, i) => <span key={i} className="px-2 py-0.5 text-[9px] font-bold text-[#c66] border border-[#8b4a4a]/40 bg-[#8b4a4a]/10">„{w}"</span>)}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Sensationalism + triggers */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {analysis.sensationalismIndex !== undefined && (
                                    <div className="editorial-card p-6 space-y-3">
                                        <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest">Сензационализъм индекс</p>
                                        <p className={`text-3xl font-black ${analysis.sensationalismIndex > 0.65 ? 'text-[#c66]' : analysis.sensationalismIndex > 0.35 ? 'text-[#d4a574]' : 'text-[#7cb87c]'}`}>{Math.round(analysis.sensationalismIndex * 100)}%</p>
                                        <div className="h-1.5 bg-[#333] rounded-full"><div className={`h-1.5 rounded-full ${analysis.sensationalismIndex > 0.65 ? 'bg-[#8b4a4a]' : analysis.sensationalismIndex > 0.35 ? 'bg-[#a67c52]' : 'bg-[#4a7c59]'}`} style={{ width: `${analysis.sensationalismIndex * 100}%` }} /></div>
                                    </div>
                                )}
                                {analysis.circularCitation && (
                                    <div className="editorial-card p-6 space-y-2 border-l-4 border-l-[#a67c52]">
                                        <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest">Кръгово цитиране</p>
                                        <p className="text-sm text-[#ccc] leading-[1.6]">{analysis.circularCitation}</p>
                                    </div>
                                )}
                            </div>

                            {/* Emotional triggers */}
                            {analysis.emotionalTriggers && analysis.emotionalTriggers.length > 0 && (
                                <div className="editorial-card p-6 md:p-8 space-y-4">
                                    <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest border-b border-[#968B74]/30 pb-1 inline-block">Емоционални тригери</p>
                                    <div className="space-y-3 pt-1">
                                        {analysis.emotionalTriggers.map((t, i) => {
                                            const emotionColor = t.emotion.includes('страх') ? 'text-[#c66] border-[#8b4a4a]/40 bg-[#8b4a4a]/10' : t.emotion.includes('гняв') ? 'text-[#d4a574] border-[#a67c52]/40 bg-[#a67c52]/10' : t.emotion.includes('гордост') ? 'text-[#7cb87c] border-[#4a7c59]/40 bg-[#4a7c59]/10' : 'text-[#C4B091] border-[#968B74]/40 bg-[#968B74]/10';
                                            return (
                                                <div key={i} className="flex gap-4 items-start p-3 bg-[#1a1a1a] border border-[#222]">
                                                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wide border shrink-0 ${emotionColor}`}>{t.emotion}</span>
                                                    <div>
                                                        <span className="text-[#E0E0E0] font-black text-sm">„{t.word}"</span>
                                                        <p className="text-xs text-[#888] mt-0.5">{t.context}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Missing voices */}
                            {analysis.missingVoices && analysis.missingVoices.length > 0 && (
                                <div className="editorial-card p-6 space-y-3 border-l-4 border-l-[#a67c52]">
                                    <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest">Липсващи гласове</p>
                                    <div className="space-y-2">{analysis.missingVoices.map((v, i) => (
                                        <div key={i} className="flex gap-3 items-start"><span className="text-[#a67c52] font-black text-xs mt-0.5 shrink-0">✕</span><p className="text-sm text-[#ccc]">{v}</p></div>
                                    ))}</div>
                                </div>
                            )}

                            {/* Alternative sources */}
                            {analysis.alternativeSources && analysis.alternativeSources.length > 0 && (
                                <div className="editorial-card p-6 space-y-4">
                                    <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest border-b border-[#968B74]/30 pb-1 inline-block">Прочети вместо това</p>
                                    <div className="space-y-3 pt-1">
                                        {analysis.alternativeSources.map((s, i) => (
                                            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="flex gap-3 items-start p-4 bg-[#1a1a1a] border border-[#222] hover:border-[#968B74]/40 transition-colors group">
                                                <span className="text-[#C4B091] font-black text-sm shrink-0 mt-0.5">→</span>
                                                <div>
                                                    <p className="text-sm font-black text-[#E0E0E0] group-hover:text-[#C4B091] transition-colors">{s.title}</p>
                                                    <p className="text-xs text-[#666] mt-0.5">{s.reason}</p>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(!analysis.headlineAnalysis && !analysis.emotionalTriggers?.length && !analysis.missingVoices?.length) && (
                                <div className="editorial-card p-10 text-center border border-dashed border-[#333]">
                                    <p className="text-[#555] text-sm">Реторичен анализ не е наличен за тази статия.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'comments' && (
                        <div className="space-y-6 animate-fadeIn">
                            {!hasComments ? (
                                <div className="editorial-card p-10 text-center space-y-4 border border-dashed border-[#333]">
                                    <p className="text-[9px] font-black text-[#555] uppercase tracking-widest">Коментари</p>
                                    <p className="text-[#555] text-sm">Не са открити публични коментари за тази статия.</p>
                                </div>
                            ) : (() => {
                                const ca = analysis.commentsAnalysis!;
                                const sentimentColor = ca.sentiment === 'positive' ? 'text-[#7cb87c]' : ca.sentiment === 'negative' ? 'text-[#c66]' : ca.sentiment === 'mixed' ? 'text-[#d4a574]' : 'text-[#C4B091]';
                                const sentimentBg = ca.sentiment === 'positive' ? 'bg-[#4a7c59]/20 border-[#4a7c59]' : ca.sentiment === 'negative' ? 'bg-[#8b4a4a]/20 border-[#8b4a4a]' : 'bg-[#968B74]/20 border-[#968B74]';
                                const sentimentLabel = ca.sentiment === 'positive' ? 'Позитивен' : ca.sentiment === 'negative' ? 'Негативен' : ca.sentiment === 'mixed' ? 'Смесен' : 'Неутрален';
                                return (
                                    <div className="space-y-6">
                                        {/* Header */}
                                        <div className="editorial-card p-6 md:p-8 border-l-4 border-l-[#968B74] space-y-4">
                                            <div className="flex flex-wrap justify-between items-start gap-4">
                                                <div>
                                                    <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-1">Анализ на коментари</p>
                                                    <p className="text-xs font-black text-[#968B74] uppercase">{ca.source}</p>
                                                </div>
                                                <div className="flex gap-3 flex-wrap">
                                                    <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest border ${sentimentBg} ${sentimentColor}`}>{sentimentLabel} тон</span>
                                                    {ca.totalAnalyzed ? <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest border border-[#333] text-[#666]">{ca.totalAnalyzed} коментара</span> : null}
                                                </div>
                                            </div>
                                            {ca.overallSummary && <p className="text-[#ccc] text-sm leading-[1.65] border-l-2 border-[#968B74] pl-4">{ca.overallSummary}</p>}
                                        </div>

                                        {/* Metrics row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {ca.polarizationIndex !== undefined && (
                                                <div className="editorial-card p-5 space-y-2">
                                                    <p className="text-[8px] font-black text-[#666] uppercase tracking-widest">Поляризация</p>
                                                    <p className={`text-2xl font-black ${ca.polarizationIndex > 0.65 ? 'text-[#c66]' : ca.polarizationIndex > 0.4 ? 'text-[#d4a574]' : 'text-[#7cb87c]'}`}>{Math.round(ca.polarizationIndex * 100)}%</p>
                                                    <div className="h-1 bg-[#333] rounded-full"><div className="h-1 bg-[#968B74] rounded-full" style={{ width: `${ca.polarizationIndex * 100}%` }} /></div>
                                                </div>
                                            )}
                                            {ca.botActivitySuspicion !== undefined && (
                                                <div className="editorial-card p-5 space-y-2">
                                                    <p className="text-[8px] font-black text-[#666] uppercase tracking-widest">Подозрение за ботове</p>
                                                    <p className={`text-2xl font-black ${ca.botActivitySuspicion > 0.5 ? 'text-[#c66]' : ca.botActivitySuspicion > 0.25 ? 'text-[#d4a574]' : 'text-[#7cb87c]'}`}>{Math.round(ca.botActivitySuspicion * 100)}%</p>
                                                    <div className="h-1 bg-[#333] rounded-full"><div className="h-1 bg-[#968B74] rounded-full" style={{ width: `${ca.botActivitySuspicion * 100}%` }} /></div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Dominant themes */}
                                        {ca.dominantThemes && ca.dominantThemes.length > 0 && (
                                            <div className="editorial-card p-6 space-y-3">
                                                <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest border-b border-[#968B74]/30 pb-1 inline-block">Доминиращи теми</p>
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {ca.dominantThemes.map((t, i) => <span key={i} className="px-3 py-1 text-[10px] font-bold text-[#C4B091] border border-[#968B74]/30 bg-[#252525] rounded-sm">{t}</span>)}
                                                </div>
                                            </div>
                                        )}

                                        {/* Key opinions */}
                                        {ca.keyOpinions && ca.keyOpinions.length > 0 && (
                                            <div className="editorial-card p-6 space-y-4">
                                                <p className="text-[8px] font-black text-[#968B74] uppercase tracking-widest border-b border-[#968B74]/30 pb-1 inline-block">Ключови мнения</p>
                                                <div className="space-y-3 pt-1">
                                                    {ca.keyOpinions.map((op, i) => (
                                                        <div key={i} className="flex gap-3 items-start">
                                                            <span className="text-[#C4B091] font-black text-xs mt-0.5 shrink-0">#{i + 1}</span>
                                                            <p className="text-[#ccc] text-sm leading-[1.6]">{op}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Manipulation in comments */}
                                        {ca.manipulationInComments && (
                                            <div className="editorial-card p-6 space-y-3 border-l-4 border-l-[#8b4a4a]">
                                                <p className="text-[8px] font-black text-[#C4B091] uppercase tracking-widest">Манипулация в коментарите</p>
                                                <p className="text-[#ccc] text-sm leading-[1.65]">{ca.manipulationInComments}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {activeTab === 'report' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="editorial-card p-8 md:p-12 border border-[#968B74]/20">
                                <div className="text-center mb-10 pb-6 border-b-2 border-[#333]">
                                    <p className="text-[9px] font-black text-[#968B74] uppercase tracking-[0.3em] mb-2">ОФИЦИАЛЕН ДОКЛАД</p>
                                    <h2 className="text-3xl md:text-4xl font-black text-[#C4B091]">Заключителен Анализ</h2>
                                </div>
                                <div className="max-w-none space-y-1 font-sans text-[15px] md:text-base leading-[1.7] text-[#ddd]">
                                    {(analysis.summary.finalInvestigativeReport || '').split(/\n/).map((line, idx) => {
                                        const trimmed = line.trim();
                                        if (!trimmed) return <br key={idx} />;
                                        if (/^\d+\.\s/.test(trimmed)) {
                                            const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
                                            const num = numMatch ? numMatch[1] : '';
                                            const rest = numMatch ? numMatch[2] : trimmed.replace(/^\d+\.\s*/, '');
                                            return (
                                                <div key={idx} className="mt-5 mb-2 flex gap-3 items-baseline">
                                                    <span className="text-[#C4B091] font-black text-base md:text-lg shrink-0 w-7">{num}.</span>
                                                    <span>{rest}</span>
                                                </div>
                                            );
                                        }
                                        return <p key={idx} className="mb-3">{trimmed}</p>;
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default LinkResultView;
