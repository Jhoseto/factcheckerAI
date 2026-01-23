
import React, { useMemo, memo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { TimelinePoint, Claim } from '../types';

interface Props {
  data: TimelinePoint[];
  claims: Claim[];
  totalDuration: string;
  language?: 'bg' | 'en';
}

const ReliabilityChart: React.FC<Props> = ({ data, claims, totalDuration }) => {
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.map((p, idx) => ({
      index: idx,
      label: p.time,
      reliability: Math.round(p.reliability > 1 ? p.reliability : p.reliability * 100),
      event: p.event || 'Няма данни за събитие',
      isAnomaly: (p.reliability < 0.4 || p.reliability > 0.9)
    }));
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-4 md:p-6 shadow-2xl max-w-[200px] md:max-w-xs border border-amber-500/30">
          <div className="flex justify-between items-center mb-2 md:mb-4 border-b border-white/10 pb-2">
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-amber-400">{data.label}</span>
            <span className="text-base md:text-xl font-black">{data.reliability}%</span>
          </div>
          <p className="text-[10px] md:text-xs leading-relaxed font-medium italic">„{data.event}“</p>
        </div>
      );
    }
    return null;
  };

  // If no data, show a placeholder instead of an empty chart
  if (!processedData || processedData.length === 0) {
    return (
      <div className="editorial-card p-6 md:p-12 border-t-8 border-t-slate-900 bg-white">
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm font-medium">Няма налични данни за графиката</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Главна графика */}
      <div className="editorial-card p-6 md:p-12 border-t-8 border-t-slate-900 bg-white">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-16 gap-6">
          <div className="text-center md:text-left w-full md:w-auto">
            <h3 className="text-[10px] md:text-[12px] font-extrabold text-amber-900 uppercase tracking-[0.3em] md:tracking-[0.5em] mb-2 md:mb-3">
              Аналитичен осцилоскоп
            </h3>
            <p className="text-2xl md:text-4xl font-black uppercase tracking-tighter serif italic leading-none">Динамика на надеждността</p>
          </div>
          <div className="text-right hidden md:block">
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Max Stability</p>
                <p className="text-xl font-black text-slate-900">{Math.max(...processedData.map(d => d.reliability), 0)}%</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Рискове</p>
                <p className="text-xl font-black text-red-600">{processedData.filter(d => d.reliability < 50).length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full h-[250px] md:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={processedData}
              onMouseMove={(e) => e.activePayload && setHoveredPoint(e.activePayload[0].payload)}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id="colorRel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#78350f" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#78350f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" hide />
              <YAxis domain={[0, 100]} orientation="right" tick={{ fontSize: 8, fontWeight: '800', fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#0f172a', strokeWidth: 1, strokeDasharray: '5 5' }} />
              <Area
                type="monotone"
                dataKey="reliability"
                stroke="#0f172a"
                strokeWidth={3}
                fill="url(#colorRel)"
                animationDuration={2000}
                connectNulls
              />
              {processedData.filter(d => d.isAnomaly).map((d, i) => (
                <ReferenceDot
                  key={i}
                  x={d.index}
                  y={d.reliability}
                  r={3}
                  fill={d.reliability < 50 ? "#dc2626" : "#059669"}
                  stroke="white"
                  strokeWidth={1}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 md:mt-8 flex justify-between text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.4em] border-t border-slate-50 pt-4 md:pt-6">
          <div className="flex items-center gap-1 md:gap-2">
            <span className="h-1.5 w-1.5 md:h-2 md:w-2 bg-slate-900"></span>
            <span>Старт</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <span className="hidden md:inline">Продължителност:</span> <span>{totalDuration}</span>
            <span className="h-1.5 w-1.5 md:h-2 md:w-2 bg-slate-900"></span>
          </div>
        </div>
      </div>

      {/* Регистър */}
      <div className="editorial-card p-6 md:p-10 bg-slate-900 text-white rounded-sm overflow-hidden relative">
        <h4 className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-amber-500 mb-6 border-b border-white/10 pb-4">Хронологичен регистър</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-2 scroll-custom">
          {processedData.map((point, idx) => (
            <div
              key={idx}
              className={`p-4 md:p-6 border border-white/5 transition-all cursor-default group hover:border-amber-500/50 ${hoveredPoint?.label === point.label ? 'bg-white/10 border-amber-500' : 'bg-white/5'}`}
            >
              <div className="flex justify-between items-start mb-2 md:mb-4">
                <span className="text-[9px] md:text-[10px] font-black text-amber-500 tracking-tighter">{point.label}</span>
                <span className={`text-[10px] md:text-xs font-black ${point.reliability < 50 ? 'text-red-500' : 'text-emerald-500'}`}>{point.reliability}%</span>
              </div>
              <p className="text-[11px] md:text-[12px] leading-relaxed font-medium text-slate-300 group-hover:text-white transition-colors">
                {point.event}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .scroll-custom::-webkit-scrollbar { width: 3px; }
        .scroll-custom::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
        .scroll-custom::-webkit-scrollbar-thumb { background: #78350f; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default memo(ReliabilityChart);
