import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Type, Search, Mic, Eye, AlertTriangle, Brain, CheckCircle2, Circle } from 'lucide-react';

interface DebugAgent {
  id: string;
  name: string;
  status: 'idle' | 'active' | 'complete';
  icon: React.ReactNode;
}

interface MobileLiveDebugOverlayProps {
  visible: boolean;
  streamingProgress?: string | null;
  elapsedSeconds?: number;
}

const MobileLiveDebugOverlay: React.FC<MobileLiveDebugOverlayProps> = ({ visible, streamingProgress, elapsedSeconds = 0 }) => {
  const { t, i18n } = useTranslation();
  const isBg = i18n.language === 'bg';
  const [displayedSeconds, setDisplayedSeconds] = useState(0);
  const [progress, setProgress] = useState(0);

  const agents: DebugAgent[] = isBg ? [
    { id: 'metadata', name: 'Метаданни', status: 'active', icon: <FileText size={16} /> },
    { id: 'transcript', name: 'Транскрипция', status: 'active', icon: <Type size={16} /> },
    { id: 'factual', name: 'Факти', status: 'active', icon: <Search size={16} /> },
    { id: 'vocal', name: 'Вокал', status: 'idle', icon: <Mic size={16} /> },
    { id: 'visual', name: 'Визуал', status: 'idle', icon: <Eye size={16} /> },
    { id: 'manipulation', name: 'Манипулация', status: 'idle', icon: <AlertTriangle size={16} /> },
    { id: 'synthesis', name: 'Синтезис', status: 'idle', icon: <Brain size={16} /> },
  ] : [
    { id: 'metadata', name: 'Metadata', status: 'active', icon: <FileText size={16} /> },
    { id: 'transcript', name: 'Transcript', status: 'active', icon: <Type size={16} /> },
    { id: 'factual', name: 'Factual', status: 'active', icon: <Search size={16} /> },
    { id: 'vocal', name: 'Vocal', status: 'idle', icon: <Mic size={16} /> },
    { id: 'visual', name: 'Visual', status: 'idle', icon: <Eye size={16} /> },
    { id: 'manipulation', name: 'Manipulation', status: 'idle', icon: <AlertTriangle size={16} /> },
    { id: 'synthesis', name: 'Synthesis', status: 'idle', icon: <Brain size={16} /> },
  ];

  const [activeAgents, setActiveAgents] = useState<string[]>(['metadata', 'transcript', 'factual']);

  // Update timer every second
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setDisplayedSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  // Update progress bar based on elapsed time
  useEffect(() => {
    if (!visible) return;

    const currentSeconds = displayedSeconds || elapsedSeconds;
    const maxDuration = 45; // Expected max duration in seconds
    const newProgress = Math.min((currentSeconds / maxDuration) * 100, 100);
    setProgress(newProgress);
  }, [displayedSeconds, elapsedSeconds, visible]);

  // Simulate agent activation over time
  useEffect(() => {
    if (!visible) return;

    const currentSeconds = displayedSeconds || elapsedSeconds;
    
    if (currentSeconds >= 11) {
      setActiveAgents(['metadata', 'transcript', 'factual', 'vocal', 'visual', 'manipulation', 'synthesis']);
    } else if (currentSeconds >= 8) {
      setActiveAgents(['metadata', 'transcript', 'factual', 'vocal', 'visual', 'manipulation']);
    } else if (currentSeconds >= 5) {
      setActiveAgents(['metadata', 'transcript', 'factual', 'vocal', 'visual']);
    } else if (currentSeconds >= 2) {
      setActiveAgents(['metadata', 'transcript', 'factual', 'vocal']);
    } else {
      setActiveAgents(['metadata', 'transcript', 'factual']);
    }
  }, [displayedSeconds, elapsedSeconds, visible]);

  if (!visible) return null;

  const currentSeconds = displayedSeconds || elapsedSeconds;

  return (
    <div className="fixed inset-0 z-[999] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#111] border border-[#968B74]/30 rounded-2xl p-6 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="animate-spin" style={{ animationDuration: '2s' }}>
                <Circle size={18} className="text-[#968B74]" />
              </span>
              <h2 className="text-lg font-serif text-[#E0E0E0] tracking-tight">
                {isBg ? 'Live Анализ' : 'Live Analysis'}
              </h2>
            </div>
            <p className="text-[#888] text-[9px] uppercase tracking-widest">
              {isBg ? 'DCGE Двигател' : 'DCGE Engine'}
            </p>
          </div>

          {/* Timer */}
          <div className="text-center mb-6">
            <p className="text-4xl font-serif text-[#C4B091] tabular-nums tracking-tight drop-shadow-lg font-mono">
              {String(Math.floor(currentSeconds / 60)).padStart(2, '0')}<span className="text-[#968B74] mx-1.5">:</span>{String(currentSeconds % 60).padStart(2, '0')}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-[#252525] border border-[#333] rounded-full overflow-hidden mb-6 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#968B74] via-[#C4B091] to-[#968B74] rounded-full shadow-[0_0_10px_rgba(196,176,145,0.5)]"
              style={{
                width: `${progress}%`,
                transition: 'width 0.5s linear',
              }}
            />
          </div>

          {/* Agents Grid - Compact */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {agents.map((agent, idx) => {
              const isActive = activeAgents.includes(agent.id);
              const isComplete = currentSeconds > 12 || (idx < 3 && currentSeconds > 3);

              return (
                <div
                  key={agent.id}
                  className={`p-2 rounded-lg border transition-all duration-500 flex flex-col items-center gap-1 ${
                    isComplete
                      ? 'bg-emerald-950/30 border-emerald-600/40'
                      : isActive
                      ? 'bg-[#968B74]/15 border-[#968B74]/60 shadow-[0_0_10px_rgba(196,176,145,0.2)]'
                      : 'bg-[#252525] border-[#333]'
                  }`}
                  style={{
                    animation: isActive && !isComplete ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  }}
                >
                  <div className={`${
                    isComplete ? 'text-emerald-400' : isActive ? 'text-[#C4B091]' : 'text-[#666]'
                  }`}>
                    {agent.icon}
                  </div>
                  <p className={`text-[7px] font-bold uppercase tracking-wider text-center leading-tight ${
                    isComplete ? 'text-emerald-400' : isActive ? 'text-[#C4B091]' : 'text-[#666]'
                  }`}>
                    {agent.name}
                  </p>
                  {isComplete && (
                    <div className="text-emerald-400">
                      <CheckCircle2 size={12} />
                    </div>
                  )}
                  {isActive && !isComplete && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C4B091] animate-pulse shadow-[0_0_6px_rgba(196,176,145,0.6)]" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Streaming Progress */}
          {streamingProgress && (
            <div className="bg-[#252525] border border-[#333] rounded-lg p-3 mb-4">
              <p className="text-[8px] text-[#888] uppercase tracking-widest mb-1">
                {isBg ? 'Статус' : 'Status'}
              </p>
              <p className="text-xs text-[#C4B091] font-medium animate-pulse">
                {streamingProgress}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center">
            <p className="text-[8px] text-[#555] uppercase tracking-widest">
              {isBg ? 'DCGE (Deep Contextual Generative Engine)' : 'DCGE (Deep Contextual Generative Engine)'}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default MobileLiveDebugOverlay;
