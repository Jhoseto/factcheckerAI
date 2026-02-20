import React from 'react';
import { VideoAnalysis } from '../../../types';
import MetricBlock from '../MetricBlock';
import { useAuth } from '../../../contexts/AuthContext';
import { makeAnalysisPublic } from '../../../services/archiveService';

interface SocialResultViewProps {
    result: VideoAnalysis;
    onReset: () => void;
    onSave?: () => void;
    user?: any;
    slotUsage?: { used: number, max: number };
}

import ShareModal from '../ShareModal';

const SocialResultView: React.FC<SocialResultViewProps> = ({ result, onReset, onSave, slotUsage }) => {
    const { currentUser } = useAuth();
    const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);

    const handleShare = async () => {
        if (!result.id) return;
        // Mark analysis as public when sharing
        if (currentUser && result.id) {
            try {
                await makeAnalysisPublic(result.id, currentUser.uid);
                console.log('Analysis marked as public:', result.id);
            } catch (error) {
                console.error('Failed to make analysis public:', error);
                alert('Грешка при маркиране на анализа като публичен. Моля, опитайте отново.');
                return; // Don't open share modal if marking as public failed
            }
        }
        setIsShareModalOpen(true);
    };

    const isFull = slotUsage && slotUsage.used >= slotUsage.max;

    return (
        <div className="bg-white editorial-card p-8 animate-fadeIn space-y-8 relative">
            {/* Action Bar */}
            <div className="absolute top-8 right-8 z-10 flex gap-2">
                {!result.id && onSave && (
                    <button
                        onClick={onSave}
                        disabled={isFull}
                        className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg ${isFull
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-amber-900 text-white hover:bg-black'
                            }`}
                        title={isFull ? 'Достигнали сте лимита за този тип анализи' : 'Запази в архив'}
                    >
                        {isFull ? 'НЯМА СЛОТОВЕ' : `ЗАПАЗИ (${slotUsage?.used ?? 0}/${slotUsage?.max ?? 0})`}
                    </button>
                )}

                {/* Share Button Group */}
                <div className="relative group">
                    <button
                        onClick={result.id ? handleShare : undefined}
                        disabled={!result.id}
                        className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg flex items-center gap-2 ${result.id
                                ? 'bg-amber-900 text-white hover:bg-black cursor-pointer'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        СПОДЕЛИ
                    </button>
                    {!result.id && (
                        <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wide rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                            Запазете доклада, за да го споделите
                            <div className="absolute bottom-full right-4 border-4 border-transparent border-b-slate-900"></div>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex justify-between items-center border-b-2 border-slate-100 pb-6">
                <h2 className="text-2xl font-black text-slate-900 serif italic">Резултати от анализа</h2>
                <button
                    onClick={onReset}
                    className="text-[9px] font-black text-amber-900 uppercase tracking-widest hover:text-amber-700 transition-colors"
                >
                    ↺ НОВ АНАЛИЗ
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <MetricBlock
                    label="Доверие"
                    value={result.summary.credibilityIndex}
                    color={result.summary.credibilityIndex > 0.6 ? 'emerald' : result.summary.credibilityIndex > 0.4 ? 'orange' : 'red'}
                />
                <MetricBlock
                    label="Манипулация"
                    value={result.summary.manipulationIndex}
                    color={result.summary.manipulationIndex < 0.3 ? 'emerald' : result.summary.manipulationIndex < 0.6 ? 'orange' : 'red'}
                />
                <div className="editorial-card p-4 border-t-2 border-t-slate-800">
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Твърдения</p>
                    <span className="text-2xl font-black text-slate-900">{result.claims.length}</span>
                </div>
                <div className="editorial-card p-4 border-t-2 border-t-slate-800">
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Оценка</p>
                    <span className={`text-sm font-black uppercase tracking-tight ${result.summary.finalClassification === 'TRUE' ? 'text-emerald-700' :
                        result.summary.finalClassification === 'FALSE' ? 'text-red-700' : 'text-amber-700'
                        }`}>
                        {result.summary.finalClassification === 'TRUE' ? 'ВЯРНО' :
                            result.summary.finalClassification === 'FALSE' ? 'НЕВЯРНО' : 'СМЕСЕНО'}
                    </span>
                </div>
            </div>

            {/* Claims */}
            {result.claims.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight border-b border-slate-200 pb-2">Идентифицирани Твърдения</h3>
                    <div className="space-y-4">
                        {result.claims.map((claim, idx) => (
                            <div key={idx} className="bg-slate-50 p-6 border-l-4" style={{ borderColor: claim.veracity.includes('вярно') && !claim.veracity.includes('не') ? '#059669' : '#dc2626' }}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-white border ${claim.veracity.includes('вярно') && !claim.veracity.includes('не') ? 'text-emerald-700 border-emerald-200' : 'text-red-700 border-red-200'
                                        }`}>
                                        {claim.veracity}
                                    </span>
                                </div>
                                <p className="text-lg font-bold text-slate-900 serif italic mb-3">"{claim.quote}"</p>
                                <p className="text-sm text-slate-600 leading-relaxed font-medium">{claim.explanation}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Overall Summary */}
            <div className="bg-amber-50/50 p-8 border border-amber-100">
                <h3 className="text-[9px] font-black text-amber-900 uppercase tracking-widest mb-4">Обобщение</h3>
                <p className="text-slate-800 leading-relaxed serif font-medium">
                    {result.summary.overallSummary || result.summary.finalInvestigativeReport}
                </p>
            </div>

            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                shareUrl={result.id ? `${window.location.origin}/report/${result.id}` : ''}
            />
        </div>
    );
};

export default SocialResultView;
