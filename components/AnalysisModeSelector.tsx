
import React, { useState } from 'react';
import { AnalysisMode, CostEstimate } from '../types';

interface AnalysisModeSelectorProps {
    selectedMode: AnalysisMode;
    onModeChange: (mode: AnalysisMode) => void;
    costEstimates: Record<AnalysisMode, CostEstimate> | null;
    disabled?: boolean;
}

const AnalysisModeSelector: React.FC<AnalysisModeSelectorProps> = ({
    selectedMode,
    onModeChange,
    costEstimates,
    disabled = false
}) => {
    const [hoveredMode, setHoveredMode] = useState<AnalysisMode | null>(null);

    const modeConfig = {
        quick: {
            label: 'БЪРЗ АНАЛИЗ',
            icon: '⚡',
            color: 'emerald',
            borderColor: 'border-emerald-700',
            bgColor: 'bg-emerald-50',
            textColor: 'text-emerald-900',
            hoverBg: 'hover:bg-emerald-100'
        },
        batch: {
            label: 'ДЪЛБОК АНАЛИЗ (Batch)',
            icon: '⏱️',
            color: 'amber',
            borderColor: 'border-amber-700',
            bgColor: 'bg-amber-50',
            textColor: 'text-amber-900',
            hoverBg: 'hover:bg-amber-100',
            discount: '-50% ОТСТЪПКА'
        },
        standard: {
            label: 'ДЪЛБОК АНАЛИЗ (Бърз)',
            icon: '🚀',
            color: 'slate',
            borderColor: 'border-slate-700',
            bgColor: 'bg-slate-50',
            textColor: 'text-slate-900',
            hoverBg: 'hover:bg-slate-100',
            discount: null
        }
    };

    const renderModeCard = (mode: AnalysisMode) => {
        const config = (modeConfig as any)[mode];
        const estimate = costEstimates?.[mode];
        const isSelected = selectedMode === mode;
        const isHovered = hoveredMode === mode;

        return (
            <div
                key={mode}
                className={`relative editorial-card p-4 cursor-pointer transition-all ${isSelected ? `${config.borderColor} border-2 ${config.bgColor}` : 'border border-slate-200'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : config.hoverBg}`}
                onClick={() => !disabled && onModeChange(mode)}
                onMouseEnter={() => setHoveredMode(mode)}
                onMouseLeave={() => setHoveredMode(null)}
            >
                {/* Discount Badge */}
                {config.discount && (
                    <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 transform rotate-2 shadow-sm z-10">
                        {config.discount}
                    </div>
                )}
                {/* Radio indicator */}
                <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${isSelected ? `${config.borderColor} ${config.bgColor}` : 'border-slate-300'
                        }`}>
                        {isSelected && <div className={`w-2.5 h-2.5 rounded-full bg-${config.color}-700`}></div>}
                    </div>

                    <div className="flex-1">
                        {/* Mode label */}
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{config.icon}</span>
                            <h4 className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${isSelected ? config.textColor : 'text-slate-700'
                                }`}>
                                {config.label}
                            </h4>
                        </div>

                        {/* Cost and time info */}
                        {estimate && (
                            <div className="space-y-1 mb-2">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-bold text-slate-500">Цена:</span>
                                    <span className={`text-base md:text-lg font-black ${config.textColor}`}>
                                        {`~$${estimate.estimatedCostUSD.toFixed(3)}`}
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-bold text-slate-500">Време:</span>
                                    <span className="text-xs font-bold text-slate-700">{estimate.estimatedTime}</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-bold text-slate-500">Токени:</span>
                                    <span className="text-xs font-bold text-slate-700">~{estimate.estimatedTokens.toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        {/* Tooltip on hover */}
                        {isHovered && estimate && (
                            <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-slate-900 text-white p-4 rounded-sm shadow-xl text-xs leading-relaxed">
                                <p className="font-black uppercase tracking-widest text-amber-500 mb-2 text-[9px]">Какво включва:</p>
                                <ul className="space-y-1">
                                    {estimate.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <span className="text-amber-500 mt-0.5">•</span>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-3 pt-3 border-t border-white/10">
                                    <p className="text-[10px] text-slate-400 italic">
                                        {mode === 'quick' && 'Препоръчва се за бърза проверка на факти и основен анализ.'}
                                        {mode === 'batch' && 'Най-добрата цена за пълен анализ. Изчакайте няколко минути за резултат.'}
                                        {mode === 'standard' && 'Моментален пълен анализ. Най-скъпа опция.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-3">
            <label className="text-[9px] md:text-[10px] font-black text-slate-700 uppercase tracking-widest block">
                Изберете режим на анализ:
            </label>
            <div className="grid grid-cols-1 gap-3">
                {(['quick', 'batch', 'standard'] as AnalysisMode[]).map(renderModeCard)}
            </div>
            {!costEstimates && (
                <p className="text-xs text-slate-500 italic">
                    Въведете YouTube URL за да видите приблизителните цени
                </p>
            )}
        </div>
    );
};

export default AnalysisModeSelector;
