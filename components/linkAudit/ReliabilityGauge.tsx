
import React from 'react';

interface Props {
    score: number; // 0 to 1
    size?: number;
}

const ReliabilityGauge: React.FC<Props> = ({ score, size = 180 }) => {
    const percentage = Math.round(score * 100);
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    const getColor = (s: number) => {
        if (s >= 0.8) return '#047857'; // emerald-700
        if (s >= 0.6) return '#059669'; // emerald-600
        if (s >= 0.4) return '#d97706'; // amber-600
        if (s >= 0.2) return '#ea580c'; // orange-600
        return '#991b1b'; // red-800
    };

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background Circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#333"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                />
                {/* Progress Circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={getColor(score)}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-[#C4B091] tracking-tighter serif italic">
                    {percentage}%
                </span>
                <span className="text-[8px] font-black text-[#666] uppercase tracking-widest mt-1">
                    Достоверност
                </span>
            </div>
        </div>
    );
};

export default ReliabilityGauge;
