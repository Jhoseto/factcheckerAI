import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DebugAgent {
  id: string;
  name: string;
  status: 'idle' | 'active' | 'complete';
  icon: string;
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

  const agents: DebugAgent[] = isBg ? [
    { id: 'metadata', name: 'Метаданни Агент', status: 'active', icon: '📋', description: 'Извличане на метаданни' },
    { id: 'transcript', name: 'Транскрипция Агент', status: 'active', icon: '📝', description: 'Обработка на текст' },
    { id: 'factual', name: 'Фактически Агент', status: 'active', icon: '🔍', description: 'Проверка на факти' },
    { id: 'vocal', name: 'Вокален Агент', status: 'idle', icon: '🎙️', description: 'Анализ на тон и емоции' },
    { id: 'visual', name: 'Визуален Агент', status: 'idle', icon: '👁️', description: 'Анализ на визуални елементи' },
    { id: 'manipulation', name: 'Манипулация Агент', status: 'idle', icon: '⚠️', description: 'Разкриване на техники' },
    { id: 'synthesis', name: 'Синтезис Агент', status: 'idle', icon: '🧠', description: 'Генериране на доклад' },
  ] : [
    { id: 'metadata', name: 'Metadata Agent', status: 'active', icon: '📋', description: 'Extracting metadata' },
    { id: 'transcript', name: 'Transcript Agent', status: 'active', icon: '📝', description: 'Processing text' },
    { id: 'factual', name: 'Factual Agent', status: 'active', icon: '🔍', description: 'Verifying facts' },
    { id: 'vocal', name: 'Vocal Agent', status: 'idle', icon: '🎙️', description: 'Analyzing tone & emotion' },
    { id: 'visual', name: 'Visual Agent', status: 'idle', icon: '👁️', description: 'Analyzing visuals' },
    { id: 'manipulation', name: 'Manipulation Agent', status: 'idle', icon: '⚠️', description: 'Detecting techniques' },
    { id: 'synthesis', name: 'Synthesis Agent', status: 'idle', icon: '🧠', description: 'Generating report' },
  ];

  const [activeAgents, setActiveAgents] = useState<string[]>(['metadata', 'transcript', 'factual']);

  useEffect(() => {
    if (!visible) return;

    // Simulate agent activation over time
    const timings = [
      { delay: 2000, agents: ['metadata', 'transcript', 'factual', 'vocal'] },
      { delay: 5000, agents: ['metadata', 'transcript', 'factual', 'vocal', 'visual'] },
      { delay: 8000, agents: ['metadata', 'transcript', 'factual', 'vocal', 'visual', 'manipulation'] },
      { delay: 11000, agents: ['metadata', 'transcript', 'factual', 'vocal', 'visual', 'manipulation', 'synthesis'] },
    ];

    const timers = timings.map(({ delay, agents: agentIds }) =>
      setTimeout(() => setActiveAgents(agentIds), delay)
    );

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#111] border border-[#968B74]/30 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-2xl">⚙️</span>
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
            <p className="text-5xl font-serif text-[#C4B091] tabular-nums tracking-tight drop-shadow-lg">
              {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}<span className="text-[#968B74] mx-2">:</span>{String(elapsedSeconds % 60).padStart(2, '0')}
            </p>
            <p className="text-[10px] text-[#666] uppercase tracking-widest mt-2">
              {isBg ? 'Прогрес на анализа' : 'Analysis Progress'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-[#252525] border border-[#333] rounded-full overflow-hidden mb-8 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#968B74] via-[#C4B091] to-[#968B74] rounded-full shadow-[0_0_10px_rgba(196,176,145,0.5)]"
              style={{
                width: `${Math.min((elapsedSeconds / 45) * 100, 100)}%`,
                transition: 'width 0.3s ease-out',
              }}
            />
          </div>

          {/* Agents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {agents.map((agent, idx) => {
              const isActive = activeAgents.includes(agent.id);
              const isComplete = elapsedSeconds > 12 || (idx < 3 && elapsedSeconds > 3);

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
                    <div className="text-2xl flex-shrink-0">{agent.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold uppercase tracking-wider ${
                        isComplete ? 'text-emerald-400' : isActive ? 'text-[#C4B091]' : 'text-[#666]'
                      }`}>
                        {agent.name}
                      </p>
                      <p className="text-xs text-[#888] mt-1">{agent.description}</p>
                    </div>
                    {isComplete && (
                      <div className="flex-shrink-0 text-emerald-400 font-bold text-lg">✓</div>
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
      `}</style>
    </div>
  );
};

export default LiveDebugOverlay;
