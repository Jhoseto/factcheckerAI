
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

    return data.map((p, idx) => {
      // Find matching claim by loose text matching if event exists, otherwise fallback to index if available
      let matchingClaim = undefined;

      if (p.event) {
        matchingClaim = claims.find(c => c.quote.includes(p.event?.substring(0, 20) || '') || p.event?.includes(c.quote.substring(0, 20)));
      }

      // Fallback to index if no text match found, but only if index is within bounds
      if (!matchingClaim && idx < claims.length) {
        matchingClaim = claims[idx];
      }

      const fullQuote = matchingClaim ? matchingClaim.quote : (p.event || 'Събитие от времевата линия');

      return {
        index: idx,
        label: p.time,
        reliability: Math.round(p.reliability > 1 ? p.reliability : p.reliability * 100),
        event: fullQuote,
        isAnomaly: (p.reliability < 0.4 || p.reliability > 0.9),
        claim: matchingClaim
      };
    });
  }, [data, claims]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#252525] border border-[#968B74]/30 p-4 md:p-6 shadow-2xl max-w-[200px] md:max-w-xs">
          <div className="flex justify-between items-center mb-2 md:mb-4 border-b border-[#333] pb-2">
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-[#968B74]">{data.label}</span>
            <span className="text-base md:text-xl font-black text-[#C4B091]">{data.reliability}%</span>
          </div>
          <p className="text-[10px] md:text-xs leading-relaxed font-medium italic text-[#ccc]">„{data.event}“</p>
        </div>
      );
    }
    return null;
  };

  // If no data, show a placeholder instead of an empty chart
  if (!processedData || processedData.length === 0) {
    return (
      <div className="editorial-card p-6 md:p-12 border-l-4 border-l-[#968B74]">
        <div className="text-center py-12">
          <p className="text-[#666] text-sm font-medium">Няма налични данни за графиката</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-12">
      <div className="editorial-card p-6 md:p-12 border-l-4 border-l-[#968B74]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-16 gap-6">
          <div className="text-center md:text-left w-full md:w-auto">
            <h3 className="text-[10px] md:text-[12px] font-extrabold text-[#968B74] uppercase tracking-[0.3em] md:tracking-[0.5em] mb-2 md:mb-3">
              Аналитичен осцилоскоп
            </h3>
            <p className="text-2xl md:text-4xl font-black uppercase tracking-tighter serif italic leading-none text-[#E0E0E0]">Динамика на надеждността</p>
          </div>
          <div className="text-right hidden md:block">
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-[9px] font-black text-[#666] uppercase tracking-widest mb-1">Max Stability</p>
                <p className="text-xl font-black text-[#C4B091]">{Math.max(...processedData.map(d => d.reliability), 0)}%</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-black text-[#666] uppercase tracking-widest mb-1">Рискове</p>
                <p className="text-xl font-black text-[#c66]">{processedData.filter(d => d.reliability < 50).length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full min-h-[300px] h-[300px] md:h-[400px] relative" style={{ minWidth: 280 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={280}>
            <AreaChart
              data={processedData}
              onMouseMove={(e: any) => e.activePayload && setHoveredPoint(e.activePayload[0].payload)}
              onMouseLeave={() => setHoveredPoint(null)}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorRel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#968B74" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#968B74" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#333" vertical={false} />
              <XAxis dataKey="label" hide />
              <YAxis domain={[0, 100]} orientation="right" tick={{ fontSize: 8, fontWeight: '800', fill: '#888' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#968B74', strokeWidth: 1, strokeDasharray: '5 5' }} />
              <Area
                type="monotone"
                dataKey="reliability"
                stroke="#C4B091"
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
                  fill={d.reliability < 50 ? "#8b4a4a" : "#4a7c59"}
                  stroke="#252525"
                  strokeWidth={1}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 md:mt-8 flex justify-between text-[9px] md:text-[11px] font-black text-[#666] uppercase tracking-[0.2em] md:tracking-[0.4em] border-t border-[#333] pt-4 md:pt-6">
          <div className="flex items-center gap-1 md:gap-2">
            <span className="h-1.5 w-1.5 md:h-2 md:w-2 bg-[#968B74]"></span>
            <span>Старт</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <span className="hidden md:inline">Продължителност:</span> <span>{totalDuration}</span>
            <span className="h-1.5 w-1.5 md:h-2 md:w-2 bg-[#968B74]"></span>
          </div>
        </div>
      </div>

      <div className="editorial-card p-6 md:p-10 border-l-4 border-l-[#968B74] overflow-hidden relative">
        <h4 className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-[#968B74] mb-6 border-b border-[#333] pb-4">Хронологичен регистър</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-2 scroll-custom">
          {processedData.map((point, idx) => (
            <div
              key={idx}
              className={`p-4 md:p-6 border border-[#333] transition-all cursor-default group hover:border-[#968B74]/40 ${hoveredPoint?.label === point.label ? 'bg-[#252525] border-[#968B74]/50' : 'bg-[#252525]/50'}`}
            >
              <div className="flex justify-between items-start mb-2 md:mb-4">
                <span className="text-[9px] md:text-[10px] font-black text-[#968B74] tracking-tighter">{point.label}</span>
                <span className={`text-[10px] md:text-xs font-black ${point.reliability < 50 ? 'text-[#c66]' : 'text-[#7cb87c]'}`}>{point.reliability}%</span>
              </div>
              <p className="text-[11px] md:text-[12px] leading-relaxed font-medium text-[#aaa] group-hover:text-[#ccc] transition-colors serif italic">
                {point.event && point.event.length > 100 ? point.event.substring(0, 100) + '...' : point.event}
              </p>
              {point.event && point.event.length > 100 && (
                <p className="text-[9px] text-[#666] mt-1 italic tracking-tight font-bold uppercase">(Пълен цитат в таб "Твърдения")</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .scroll-custom::-webkit-scrollbar { width: 3px; }
        .scroll-custom::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
        .scroll-custom::-webkit-scrollbar-thumb { background: #968B74; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default memo(ReliabilityChart);
