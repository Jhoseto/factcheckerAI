import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Type, Search, Mic, Eye, AlertTriangle, Brain, CheckCircle2, Circle } from 'lucide-react';

interface DebugAgent {
  id: string;
  name: string;
  status: 'idle' | 'active' | 'complete';
  icon: React.ReactNode;
  description: string;
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
  const [activeConnections, setActiveConnections] = useState<string[]>([]);

  const agents: DebugAgent[] = isBg ? [
    { id: 'metadata', name: 'Метаданни', status: 'active', icon: <FileText size={20} />, description: 'Извличане на метаданни' },
    { id: 'transcript', name: 'Транскрипция', status: 'active', icon: <Type size={20} />, description: 'Обработка на текст' },
    { id: 'factual', name: 'Факти', status: 'active', icon: <Search size={20} />, description: 'Проверка на факти' },
    { id: 'vocal', name: 'Вокал', status: 'idle', icon: <Mic size={20} />, description: 'Анализ на тон' },
    { id: 'visual', name: 'Визуал', status: 'idle', icon: <Eye size={20} />, description: 'Анализ на визуали' },
    { id: 'manipulation', name: 'Манипулация', status: 'idle', icon: <AlertTriangle size={20} />, description: 'Разкриване' },
    { id: 'synthesis', name: 'Синтезис', status: 'idle', icon: <Brain size={20} />, description: 'Генериране' },
  ] : [
    { id: 'metadata', name: 'Metadata', status: 'active', icon: <FileText size={20} />, description: 'Extracting metadata' },
    { id: 'transcript', name: 'Transcript', status: 'active', icon: <Type size={20} />, description: 'Processing text' },
    { id: 'factual', name: 'Factual', status: 'active', icon: <Search size={20} />, description: 'Verifying facts' },
    { id: 'vocal', name: 'Vocal', status: 'idle', icon: <Mic size={20} />, description: 'Analyzing tone' },
    { id: 'visual', name: 'Visual', status: 'idle', icon: <Eye size={20} />, description: 'Analyzing visuals' },
    { id: 'manipulation', name: 'Manipulation', status: 'idle', icon: <AlertTriangle size={20} />, description: 'Detecting' },
    { id: 'synthesis', name: 'Synthesis', status: 'idle', icon: <Brain size={20} />, description: 'Generating' },
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

  const [activeAgents, setActiveAgents] = useState<string[]>(['metadata', 'transcript', 'factual']);

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
    const maxDuration = 360; // 6 minutes
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

  // Simulate agent activation and connections
  useEffect(() => {
    if (!visible) return;

    const currentSeconds = displayedSeconds || elapsedSeconds;
    
    if (currentSeconds >= 11) {
      setActiveAgents(['metadata', 'transcript', 'factual', 'vocal', 'visual', 'manipulation', 'synthesis']);
      setActiveConnections(['metadata-transcript', 'transcript-factual', 'factual-vocal', 'vocal-visual', 'visual-manipulation', 'manipulation-synthesis']);
    } else if (currentSeconds >= 8) {
      setActiveAgents(['metadata', 'transcript', 'factual', 'vocal', 'visual', 'manipulation']);
      setActiveConnections(['metadata-transcript', 'transcript-factual', 'factual-vocal', 'vocal-visual', 'visual-manipulation']);
    } else if (currentSeconds >= 5) {
      setActiveAgents(['metadata', 'transcript', 'factual', 'vocal', 'visual']);
      setActiveConnections(['metadata-transcript', 'transcript-factual', 'factual-vocal', 'vocal-visual']);
    } else if (currentSeconds >= 2) {
      setActiveAgents(['metadata', 'transcript', 'factual', 'vocal']);
      setActiveConnections(['metadata-transcript', 'transcript-factual', 'factual-vocal']);
    } else {
      setActiveAgents(['metadata', 'transcript', 'factual']);
      setActiveConnections(['metadata-transcript', 'transcript-factual']);
    }
  }, [displayedSeconds, elapsedSeconds, visible]);

  if (!visible) return null;

  const currentSeconds = displayedSeconds || elapsedSeconds;
  const agentPositions: Record<string, { x: number; y: number }> = {
    metadata: { x: 10, y: 30 },
    transcript: { x: 50, y: 30 },
    factual: { x: 90, y: 30 },
    vocal: { x: 10, y: 70 },
    visual: { x: 50, y: 70 },
    manipulation: { x: 90, y: 70 },
    synthesis: { x: 50, y: 110 },
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#111] border border-[#968B74]/30 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="animate-spin" style={{ animationDuration: '2s' }}>
                <Circle size={24} className="text-[#968B74]" />
              </span>
              <h2 className="text-2xl font-serif text-[#E0E0E0] tracking-tight">
                {isBg ? 'Live Анализ' : 'Live Analysis'}
              </h2>
            </div>
            <p className="text-[#888] text-sm uppercase tracking-widest">
              {isBg ? 'DCGE Двигател в действие' : 'DCGE Engine in Action'}
            </p>
          </div>

          {/* Timer */}
          <div className="text-center mb-8">
            <p className="text-5xl font-serif text-[#C4B091] tabular-nums tracking-tight drop-shadow-lg font-mono">
              {String(Math.floor(currentSeconds / 60)).padStart(2, '0')}<span className="text-[#968B74] mx-2">:</span>{String(currentSeconds % 60).padStart(2, '0')}
            </p>
            <p className="text-[10px] text-[#666] uppercase tracking-widest mt-2">
              {isBg ? 'Прогрес на анализа' : 'Analysis Progress'}
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

          {/* Visualization Canvas */}
          <div className="relative w-full h-64 bg-[#252525] border border-[#333] rounded-xl mb-8 overflow-hidden">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice">
              {/* Connection lines between agents */}
              {activeConnections.map((conn, idx) => {
                const [from, to] = conn.split('-');
                const fromPos = agentPositions[from];
                const toPos = agentPositions[to];
                if (!fromPos || !toPos) return null;

                return (
                  <g key={idx}>
                    <line
                      x1={fromPos.x}
                      y1={fromPos.y}
                      x2={toPos.x}
                      y2={toPos.y}
                      stroke="#968B74"
                      strokeWidth="0.5"
                      opacity="0.3"
                    />
                    <circle
                      cx={fromPos.x + (toPos.x - fromPos.x) * 0.5}
                      cy={fromPos.y + (toPos.y - fromPos.y) * 0.5}
                      r="0.8"
                      fill="#C4B091"
                      opacity="0.6"
                      style={{
                        animation: `pulse 1.5s ease-in-out infinite`,
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Agent nodes */}
            <div className="absolute inset-0">
              {agents.map((agent) => {
                const isActive = activeAgents.includes(agent.id);
                const isComplete = currentSeconds > 12 || (agents.indexOf(agent) < 3 && currentSeconds > 3);
                const pos = agentPositions[agent.id];

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
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                        isComplete
                          ? 'bg-emerald-950/40 border-emerald-600 text-emerald-400'
                          : isActive
                          ? 'bg-[#968B74]/30 border-[#968B74] text-[#C4B091] shadow-[0_0_15px_rgba(196,176,145,0.4)]'
                          : 'bg-[#1a1a1a]/40 border-[#333] text-[#666]'
                      }`}
                      style={{
                        animation: isActive && !isComplete ? 'pulse 1.5s ease-in-out infinite' : 'none',
                      }}
                    >
                      {agent.icon}
                    </div>
                    <p className="text-[9px] text-[#888] mt-2 text-center whitespace-nowrap">{agent.name}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dynamic Quote */}
          <div className="bg-[#252525] border border-[#333] rounded-xl p-6 mb-8 min-h-20 flex items-center justify-center">
            <p
              className="text-center text-[#C4B091] font-serif text-lg leading-relaxed"
              style={{
                animation: 'fadeInOut 3s ease-in-out infinite',
              }}
            >
              {quotes[currentQuoteIndex]}
            </p>
          </div>

          {/* Agents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {agents.map((agent, idx) => {
              const isActive = activeAgents.includes(agent.id);
              const isComplete = currentSeconds > 12 || (idx < 3 && currentSeconds > 3);

              return (
                <div
                  key={agent.id}
                  className={`p-4 rounded-xl border transition-all duration-500 ${
                    isComplete
                      ? 'bg-emerald-950/30 border-emerald-600/40'
                      : isActive
                      ? 'bg-[#968B74]/15 border-[#968B74]/60 shadow-[0_0_15px_rgba(196,176,145,0.2)]'
                      : 'bg-[#252525] border-[#333]'
                  }`}
                  style={{
                    animation: isActive && !isComplete ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 ${
                      isComplete ? 'text-emerald-400' : isActive ? 'text-[#C4B091]' : 'text-[#666]'
                    }`}>
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold uppercase tracking-wider ${
                        isComplete ? 'text-emerald-400' : isActive ? 'text-[#C4B091]' : 'text-[#666]'
                      }`}>
                        {agent.name}
                      </p>
                      <p className="text-xs text-[#888] mt-1">{agent.description}</p>
                    </div>
                    {isComplete && (
                      <div className="flex-shrink-0 text-emerald-400">
                        <CheckCircle2 size={18} />
                      </div>
                    )}
                    {isActive && !isComplete && (
                      <div className="flex-shrink-0">
                        <div className="w-3 h-3 rounded-full bg-[#C4B091] animate-pulse shadow-[0_0_8px_rgba(196,176,145,0.6)]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeInOut {
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
