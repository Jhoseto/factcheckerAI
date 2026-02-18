import React from 'react';

interface MetricBlockProps {
    label: string;
    value: number;
    color: 'blue' | 'emerald' | 'orange' | 'red';
}

const MetricBlock: React.FC<MetricBlockProps> = ({ label, value, color }) => {
    const val = Math.round(value > 1 ? value : value * 100);
    const colorMap: Record<string, string> = {
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

export default MetricBlock;
