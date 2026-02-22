import React from 'react';

interface MetricBlockProps {
    label: string;
    value: number;
    color: 'blue' | 'emerald' | 'orange' | 'red';
}

const MetricBlock: React.FC<MetricBlockProps> = ({ label, value, color }) => {
    const val = Math.round(value > 1 ? value : value * 100);
    const colorMap: Record<string, string> = {
        blue: 'bg-[#5E5646]',
        emerald: 'bg-[#4a7c59]',
        orange: 'bg-[#a67c52]',
        red: 'bg-[#8b4a4a]'
    };

    return (
        <div className="editorial-card p-5 border-l-2 border-l-[#968B74]/40">
            <p className="text-[8px] md:text-[9px] font-bold text-[#666] uppercase tracking-widest mb-2">{label}</p>
            <div className="flex items-baseline gap-1">
                <span className="text-xl md:text-2xl font-black text-[#C4B091] tracking-tighter">{val}%</span>
            </div>
            <div className="w-full h-1 bg-[#333] mt-3 overflow-hidden rounded-full">
                <div className={`h-full ${colorMap[color] || 'bg-[#968B74]'} transition-all duration-1000 rounded-full`} style={{ width: `${val}%` }} />
            </div>
        </div>
    );
};

export default MetricBlock;
