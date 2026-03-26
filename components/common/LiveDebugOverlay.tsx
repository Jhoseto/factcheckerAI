import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Type, Search, Mic, Eye, AlertTriangle, Brain } from 'lucide-react';

interface DebugAgent {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
}

interface LiveDebugOverlayProps {
  visible: boolean;
  streamingProgress?: string | null;
  elapsedSeconds?: number;
}

const LiveDebugOverlay: React.FC<LiveDebugOverlayProps> = ({ visible, streamingProgress, elapsedSeconds = 0 }) => {
  const { t, i18n } = useTranslation();
  const isBg = i18n.language === 'bg';
  const [displayedSeconds, setDisplayedSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [activeAgents, setActiveAgents] = useState<string[]>(['metadata', 'transcript', 'factual']);

  const agents: DebugAgent[] = [
    { id: 'metadata', name: isBg ? 'Метаданни' : 'Metadata', icon: <FileText size={24} />, color: 'from-amber-600 to-amber-400' },
    { id: 'transcript', name: isBg ? 'Транскрипция' : 'Transcript', icon: <Type size={24} />, color: 'from-orange-600 to-orange-400' },
    { id: 'factual', name: isBg ? 'Факти' : 'Factual', icon: <Search size={24} />, color: 'from-yellow-600 to-yellow-400' },
    { id: 'vocal', name: isBg ? 'Вокал' : 'Vocal', icon: <Mic size={24} />, color: 'from-red-600 to-red-400' },
    { id: 'visual', name: isBg ? 'Визуал' : 'Visual', icon: <Eye size={24} />, color: 'from-pink-600 to-pink-400' },
    { id: 'manipulation', name: isBg ? 'Манипулация' : 'Manipulation', icon: <AlertTriangle size={24} />, color: 'from-purple-600 to-purple-400' },
    { id: 'synthesis', name: isBg ? 'Синтезис' : 'Synthesis', icon: <Brain size={24} />, color: 'from-indigo-600 to-indigo-400' },
  ];

  const quotes = isBg ? [
    'Анализирам видео метаданни и контекст...',
    'Кръстосвам информацията с Google базите данни...',
    'Разпознавам емоции и тон в речта...',
    'Идентифицирам манипулативни техники...',
    'Синтезирам резултатите в доклад...',
    'Проверявам фактическата точност на твърденията...',
  ] : [
    'Analyzing video metadata and context...',
    'Cross-referencing with Google databases...',
    'Recognizing emotions and tone in speech...',
    'Identifying manipulative techniques...',
    'Synthesizing results into a report...',
    'Verifying factual accuracy of claims...',
  ];

  // Update timer every second
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setDisplayedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  // Update progress bar (6 minutes = 360 seconds)
  useEffect(() => {
    if (!visible) return;
    const currentSeconds = displayedSeconds || elapsedSeconds;
    const maxDuration = 360;
    const newProgress = Math.min((currentSeconds / maxDuration) * 100, 100);
    setProgress(newProgress);
  }, [displayedSeconds, elapsedSeconds, visible]);

  // Rotate quotes every 3 seconds
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setCurrentQuoteIndex(prev => (prev + 1) % quotes.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [visible, quotes.length]);

  // Simulate agent activation
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

  // Calculate agent positions in a circular/organic pattern
  const getAgentPosition = (index: number, total: number) => {
    const angle = (index / total) * Math.PI * 2;
    const radius = 35; // percentage from center
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    return { x, y };
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#111] border border-[#968B74]/30 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif text-[#E0E0E0] tracking-tight mb-2">
              {isBg ? 'Live Анализ' : 'Live Analysis'}
            </h2>
            <p className="text-[#888] text-sm uppercase tracking-widest">
              {isBg ? 'DCGE Двигател в действие' : 'DCGE Engine in Action'}
            </p>
          </div>

          {/* Timer */}
          <div className="text-center mb-8">
            <p className="text-6xl font-serif text-[#C4B091] tabular-nums tracking-tight drop-shadow-lg font-mono">
              {String(Math.floor(currentSeconds / 60)).padStart(2, '0')}<span className="text-[#968B74] mx-3">:</span>{String(currentSeconds % 60).padStart(2, '0')}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-[#252525] border border-[#333] rounded-full overflow-hidden mb-12 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#968B74] via-[#C4B091] to-[#968B74] rounded-full shadow-[0_0_10px_rgba(196,176,145,0.5)]"
              style={{
                width: `${progress}%`,
                transition: 'width 0.5s linear',
              }}
            />
          </div>

          {/* Agent Visualization Canvas */}
          <div className="relative w-full aspect-square bg-[#252525] border border-[#333] rounded-xl mb-12 overflow-hidden">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
              {/* Connection lines between active agents */}
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="1" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Animated connection lines */}
              {activeAgents.map((agentId, idx) => {
                if (idx === 0) return null;
                const prevAgent = activeAgents[idx - 1];
                const prevPos = getAgentPosition(agents.findIndex(a => a.id === prevAgent), agents.length);
                const currPos = getAgentPosition(agents.findIndex(a => a.id === agentId), agents.length);

                return (
                  <g key={`line-${agentId}`}>
                    <line
                      x1={prevPos.x}
                      y1={prevPos.y}
                      x2={currPos.x}
                      y2={currPos.y}
                      stroke="#968B74"
                      strokeWidth="0.3"
                      opacity="0.2"
                    />
                    {/* Animated pulse along the line */}
                    <circle
                      cx={prevPos.x + (currPos.x - prevPos.x) * 0.5}
                      cy={prevPos.y + (currPos.y - prevPos.y) * 0.5}
                      r="0.6"
                      fill="#C4B091"
                      opacity="0.8"
                      style={{
                        animation: `pulse 1.5s ease-in-out infinite`,
                      }}
                      filter="url(#glow)"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Agent nodes - floating and animated */}
            <div className="absolute inset-0">
              {agents.map((agent, idx) => {
                const isActive = activeAgents.includes(agent.id);
                const pos = getAgentPosition(idx, agents.length);

                return (
                  <div
                    key={agent.id}
                    className="absolute flex flex-col items-center"
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {/* Outer glow */}
                    <div
                      className={`absolute w-16 h-16 rounded-full transition-all duration-500 ${
                        isActive
                          ? `bg-gradient-to-br ${agent.color} opacity-20 blur-xl`
                          : 'bg-transparent'
                      }`}
                      style={{
                        animation: isActive ? 'pulse 2s ease-in-out infinite' : 'none',
                      }}
                    />

                    {/* Icon container */}
                    <div
                      className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                        isActive
                          ? `bg-gradient-to-br ${agent.color} border-[#C4B091] text-white shadow-lg`
                          : 'bg-[#1a1a1a]/60 border-[#444] text-[#666]'
                      }`}
                      style={{
                        animation: isActive ? 'float 3s ease-in-out infinite' : 'none',
                      }}
                    >
                      {agent.icon}
                    </div>

                    {/* Label */}
                    <p className={`text-[9px] font-bold uppercase tracking-wider mt-3 text-center whitespace-nowrap transition-colors duration-500 ${
                      isActive ? 'text-[#C4B091]' : 'text-[#555]'
                    }`}>
                      {agent.name}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dynamic Quote - Cinematic */}
          <div className="bg-[#252525] border border-[#333] rounded-xl p-8 mb-8 min-h-24 flex items-center justify-center relative overflow-hidden">
            {/* Background shimmer */}
            <div className="absolute inset-0 opacity-0 hover:opacity-5 transition-opacity duration-300 bg-gradient-to-r from-[#968B74] via-transparent to-[#968B74]" />
            
            <p
              className="text-center text-[#C4B091] font-serif text-lg leading-relaxed relative z-10"
              style={{
                animation: 'fadeInOutCinematic 3s ease-in-out infinite',
              }}
            >
              {quotes[currentQuoteIndex]}
            </p>
          </div>

          {/* Streaming Progress */}
          {streamingProgress && (
            <div className="bg-[#252525] border border-[#333] rounded-xl p-4 mb-6">
              <p className="text-[10px] text-[#888] uppercase tracking-widest mb-2">
                {isBg ? 'Текущ статус' : 'Current Status'}
              </p>
              <p className="text-sm text-[#C4B091] font-medium animate-pulse">
                {streamingProgress}
              </p>
            </div>
          )}

          {/* Footer Info */}
          <div className="text-center">
            <p className="text-[9px] text-[#555] uppercase tracking-widest">
              {isBg ? 'Захранвано от DCGE (Deep Contextual Generative Engine)' : 'Powered by DCGE (Deep Contextual Generative Engine)'}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeInOutCinematic {
          0% { opacity: 0; transform: translateY(10px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export default LiveDebugOverlay;
