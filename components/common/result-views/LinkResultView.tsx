import React, { useState } from 'react';
import { VideoAnalysis } from '../../../types';
// import { User } from 'firebase/auth'; // Not strictly used in component logic yet
import MetricBlock from '../MetricBlock';
import ReliabilityGauge from '../../linkAudit/ReliabilityGauge';

interface LinkResultViewProps {
    analysis: VideoAnalysis;
    url: string;
    price: number;
    onSave?: () => void;
    onReset?: () => void;
    slotUsage?: { used: number, max: number };
    user?: any; // strict typing later
}

import ShareModal from '../ShareModal';

const LinkResultView: React.FC<LinkResultViewProps> = ({ analysis, url, price, onSave, onReset, slotUsage }) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'claims' | 'manipulation' | 'report'>('summary');
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const handleShare = () => {
        if (!analysis.id) return;
        setIsShareModalOpen(true);
    };

    const isFull = slotUsage && slotUsage.used >= slotUsage.max;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10 animate-fadeIn relative">
            {/* Sidebar (Actions & Metrics) */}
            <aside className="lg:col-span-3 space-y-4 print:hidden sticky top-[110px] self-start h-fit">
                {/* Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                    <MetricBlock label="Фактическа Точност" value={analysis.summary.detailedStats.factualAccuracy} color="emerald" />
                    <MetricBlock label="Логическа Стройност" value={analysis.summary.detailedStats.logicalSoundness} color="blue" />
                    <MetricBlock label="Емоционална Окраска" value={analysis.summary.detailedStats.emotionalBias} color="orange" />
                    <MetricBlock label="Пропаганден Индекс" value={analysis.summary.detailedStats.propagandaScore} color="red" />
                </div>

                {/* Classification */}
                <div className="editorial-card p-4 border-l-2 border-l-amber-900 bg-amber-50/30">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">КЛАСИФИКАЦИЯ</p>
                    <span className={`text-slate-900 font-black text-sm md:text-base block leading-tight uppercase tracking-tighter serif italic ${analysis.summary.finalClassification === 'ACCURATE' ? 'text-emerald-900' :
                        analysis.summary.finalClassification === 'MISLEADING' ? 'text-orange-900' :
                            analysis.summary.finalClassification === 'FALSE' ? 'text-red-900' : 'text-slate-900'
                        }`}>
                        {analysis.summary.finalClassification === 'ACCURATE' ? 'ДОСТОВЕРНО' :
                            analysis.summary.finalClassification === 'MOSTLY_ACCURATE' ? 'ПРЕДИМНО ТОЧНО' :
                                analysis.summary.finalClassification === 'MIXED' ? 'СМЕСЕНИ ДАННИ' :
                                    analysis.summary.finalClassification === 'MISLEADING' ? 'ПОДВЕЖДАЩО' : 'НЕВЯРНО'}
                    </span>
                </div>

                {/* Cost */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-sm">
                    <p className="text-[7px] font-black text-emerald-700 uppercase tracking-widest mb-0.5">Цена на анализа</p>
                    <p className="text-lg font-black text-emerald-900">{price} точки</p>
                </div>

                {/* Info */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-sm">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Източник</p>
                    <p className="text-xs font-black text-slate-900 truncate">
                        {(() => {
                            try {
                                return new URL(url).hostname;
                            } catch {
                                return url || 'Неизвестен източник';
                            }
                        })()}
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-2">
                    {!analysis.id && onSave && (
                        <button
                            onClick={onSave}
                            disabled={isFull}
                            className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg w-full ${isFull
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-amber-900 text-white hover:bg-black'
                                }`}
                            title={isFull ? 'Достигнали сте лимита за този тип анализи' : 'Запази в архив'}
                        >
                            {isFull ? 'НЯМА СЛОТОВЕ' : `ЗАПАЗИ (${slotUsage?.used ?? 0}/${slotUsage?.max ?? 0})`}
                        </button>
                    )}

                    {/* Share Button */}
                    <div className="w-full relative group">
                        <button
                            onClick={analysis.id ? handleShare : undefined}
                            disabled={!analysis.id}
                            className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg flex items-center justify-center gap-2 w-full ${analysis.id
                                ? 'bg-amber-900 text-white hover:bg-black cursor-pointer'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                        >
                            СПОДЕЛИ ДОКЛАДА
                        </button>
                        {!analysis.id && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wide rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                Запазете доклада, за да го споделите
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                            </div>
                        )}
                    </div>

                    {onReset && (
                        <button
                            onClick={onReset}
                            className="bg-slate-200 text-slate-800 px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-red-600 transition-colors shadow-lg w-full flex items-center justify-center gap-2"
                            title="Затвори и Нов Анализ"
                        >
                            <span>✕</span> ЗАТВОРИ
                        </button>
                    )}
                </div>
            </aside>

            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                shareUrl={analysis.id ? `${window.location.origin}/report/${analysis.id}` : ''}
            />

            {/* Main Content */}
            <main className="lg:col-span-9 space-y-6">
                {/* Navigation Tabs */}
                <nav className="flex flex-wrap gap-x-8 gap-y-2 border-b border-slate-200 sticky top-[110px] md:top-[120px] bg-[#f9f9f9]/95 backdrop-blur-md z-40 py-3 print:hidden transition-all duration-300">
                    {(['summary', 'claims', 'manipulation', 'report'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap pb-1 relative transition-all flex items-center gap-1.5 ${activeTab === tab ? 'text-amber-900' : 'text-slate-400 hover:text-slate-900'
                                }`}
                        >
                            {tab === 'summary' ? 'Резюме' :
                                tab === 'claims' ? 'Верификация' :
                                    tab === 'manipulation' ? 'Манипулация' : 'Финален Доклад'}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-900"></div>
                            )}
                        </button>
                    ))}
                </nav>

                <section className="min-h-[400px]">
                    {activeTab === 'summary' && (
                        <div className="space-y-10 animate-fadeIn">
                            {/* Header Card */}
                            <div className="editorial-card p-6 md:p-8 border-l-4 border-l-slate-900 space-y-4 bg-white">
                                <div className="flex flex-col md:flex-row gap-8 items-center">
                                    <div className="flex-shrink-0 w-32 h-32 md:w-40 md:h-40">
                                        <ReliabilityGauge score={analysis.summary.detailedStats.factualAccuracy} />
                                    </div>
                                    <div className="space-y-2 flex-1 text-center md:text-left">
                                        <p className="text-[8px] font-black text-amber-900 uppercase tracking-widest">Дълбок Анализ на Текст</p>
                                        <h2 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight serif italic leading-tight">{analysis.videoTitle}</h2>
                                        <div className="pt-2">
                                            <span className={`px-3 py-1 text-[10px] font-black text-white uppercase tracking-widest inline-block rounded-sm
                                                ${analysis.summary.finalClassification === 'ACCURATE' ? 'bg-emerald-700' :
                                                    analysis.summary.finalClassification === 'MOSTLY_ACCURATE' ? 'bg-emerald-600' :
                                                        analysis.summary.finalClassification === 'MIXED' ? 'bg-amber-600' :
                                                            analysis.summary.finalClassification === 'MISLEADING' ? 'bg-orange-700' : 'bg-red-800'}`}>
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
                                <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-900 pb-1 inline-block">Изпълнително Резюме</h3>
                                <p className="text-slate-800 text-base md:text-xl leading-relaxed serif italic border-l-2 border-amber-900 pl-6 py-2 bg-amber-50/20">
                                    „{analysis.summary.overallSummary}“
                                </p>
                            </div>

                            <div className="editorial-card p-8 space-y-4 border-l-4 border-l-amber-900 bg-white">
                                <h3 className="text-[9px] font-black text-amber-900 uppercase tracking-widest border-b border-amber-900 pb-1 inline-block">Стратегически Препоръки</h3>
                                <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{analysis.summary.recommendations}</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'claims' && (
                        <div className="space-y-6 animate-fadeIn">
                            {/* Disclaimer */}
                            <div className="p-4 bg-slate-100 border border-slate-200 rounded-sm text-center">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                    Открити са {analysis.claims.length} твърдения за проверка
                                </p>
                            </div>

                            {analysis.claims.map((claim, idx) => (
                                <div key={idx} className="editorial-card p-6 md:p-8 space-y-6 border-t-2 border-t-slate-800 bg-white">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                                        <span className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest border ${claim.veracity.toLowerCase().includes('невярно') ? 'border-red-700 text-red-700 bg-red-50' : 'border-emerald-700 text-emerald-700 bg-emerald-50'}`}>{claim.veracity}</span>
                                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">Твърдение #{idx + 1}</div>
                                    </div>
                                    <blockquote className="text-lg md:text-2xl font-black text-slate-900 leading-tight serif italic tracking-tighter">„{claim.quote}“</blockquote>
                                    <div className="p-4 bg-slate-50 border-l-4 border-slate-200">
                                        <h5 className="text-[8px] font-black text-slate-900 uppercase tracking-widest mb-1">Анализ на фактите</h5>
                                        <p className="text-slate-700 leading-relaxed font-medium text-sm">{claim.explanation}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'manipulation' && (
                        <div className="space-y-6 animate-fadeIn">
                            {analysis.manipulations.map((tech, idx) => (
                                <div key={idx} className="editorial-card p-6 md:p-8 space-y-4 border-l-4 bg-white hover:shadow-lg transition-shadow"
                                    style={{ borderLeftColor: tech.severity > 0.7 ? '#dc2626' : tech.severity > 0.4 ? '#d97706' : '#f59e0b' }}>
                                    <div className="flex justify-between items-start">
                                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight italic serif">{tech.technique}</h4>
                                        <div className="bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Тежест: {Math.round(tech.severity * 100)}%</span>
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">{tech.logic.substring(0, 100)}...</p>
                                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{tech.logic}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'report' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="editorial-card p-8 md:p-12 bg-white shadow-sm border border-slate-200">
                                <div className="text-center mb-10 pb-6 border-b-2 border-slate-900">
                                    <p className="text-[9px] font-black text-amber-900 uppercase tracking-[0.3em] mb-2">ОФИЦИАЛЕН ДОКЛАД</p>
                                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 italic serif">Заключителен Анализ</h2>
                                </div>
                                <div className="prose prose-slate max-w-none prose-headings:font-black prose-headings:uppercase prose-p:leading-relaxed prose-p:text-slate-700 prose-p:font-medium">
                                    <div className="whitespace-pre-wrap font-serif text-lg leading-relaxed">
                                        {analysis.summary.finalInvestigativeReport}
                                    </div>
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
