/**
 * Пълен екран overlay по време на анализ (видео или линк).
 * Таймер, един статус ред (вкл. KB), прогрес-бар, едно изречение на едно място с плавно появяване/изчезване.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const LOADING_PHASE_KEYS = ['loading.phase0', 'loading.phase1', 'loading.phase2', 'loading.phase3', 'loading.phase4', 'loading.phase5'] as const;
const ANALYSIS_STEP_KEYS = ['loading.step0', 'loading.step1', 'loading.step2', 'loading.step3', 'loading.step4', 'loading.step5', 'loading.step6', 'loading.step7', 'loading.step8', 'loading.step9', 'loading.step10', 'loading.step11'] as const;

const STEP_DURATION_MS = 3200;
const TRANSITION_MS = 450;

interface AnalysisLoadingOverlayProps {
  visible: boolean;
  streamingProgress?: string | null;
}

const AnalysisLoadingOverlay: React.FC<AnalysisLoadingOverlayProps> = ({
  visible,
  streamingProgress = null,
}) => {
  const { t } = useTranslation();
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [displayedStepIndex, setDisplayedStepIndex] = useState(0);
  const [exitingStepIndex, setExitingStepIndex] = useState<number | null>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedStepRef = useRef(0);
  const exitingRef = useRef<number | null>(null);
  displayedStepRef.current = displayedStepIndex;
  exitingRef.current = exitingStepIndex;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (visible) {
      setLoadingPhase(0);
      setElapsedSeconds(0);
      setDisplayedStepIndex(0);
      setExitingStepIndex(null);
      interval = setInterval(() => {
        setLoadingPhase((prev) => (prev + 1) % LOADING_PHASE_KEYS.length);
      }, 3500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const stepInterval = setInterval(() => {
      if (exitingRef.current !== null) return;
      setExitingStepIndex(displayedStepRef.current);
    }, STEP_DURATION_MS);
    return () => clearInterval(stepInterval);
  }, [visible]);

  useEffect(() => {
    if (!visible || exitingStepIndex === null) return;
    exitTimeoutRef.current = setTimeout(() => {
      setDisplayedStepIndex((prev) => (prev + 1) % ANALYSIS_STEP_KEYS.length);
      setExitingStepIndex(null);
    }, TRANSITION_MS);
    return () => {
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    };
  }, [visible, exitingStepIndex]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (visible) {
      timer = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [visible]);

  if (!visible) return null;

  const showingIndex = exitingStepIndex ?? displayedStepIndex;
  const isExiting = exitingStepIndex !== null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1a1a1a] px-6 overflow-hidden"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="w-full max-w-lg flex flex-col items-center gap-6">
        <p className="text-[9px] font-black text-[#968B74] uppercase tracking-[0.35em]">
          {t('loading.title')}
        </p>
        <p className="text-4xl font-serif text-[#C4B091] tabular-nums tracking-tight">
          {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:
          {String(elapsedSeconds % 60).padStart(2, '0')}
        </p>
        <p
          key={streamingProgress || 'phase'}
          className="analysis-status-line text-[12px] text-[#C4B091] font-medium"
        >
          {streamingProgress || t(LOADING_PHASE_KEYS[loadingPhase])}
        </p>
        <div className="w-full h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#5E5646] to-[#C4B091] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(92, 15 + (elapsedSeconds / 420) * 77)}%` }}
          />
        </div>
      </div>
      <div className="mt-8 w-full max-w-xl min-h-[4rem] flex items-center justify-center px-4">
        <p
          key={showingIndex}
          className={`analysis-step-single text-[12px] text-[#C4B091]/90 leading-relaxed text-center max-w-lg border-l-2 border-[#968B74]/30 pl-4 py-2 ${isExiting ? 'analysis-step-out' : 'analysis-step-in'}`}
        >
          {t(ANALYSIS_STEP_KEYS[showingIndex])}
        </p>
      </div>
      <style>{`
        @keyframes analysisStatusIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .analysis-status-line {
          animation: analysisStatusIn 0.35s ease-out forwards;
          min-height: 1.5rem;
        }
        @keyframes analysisStepIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes analysisStepOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-10px); }
        }
        .analysis-step-in {
          animation: analysisStepIn ${TRANSITION_MS}ms ease-out forwards;
        }
        .analysis-step-out {
          animation: analysisStepOut ${TRANSITION_MS}ms ease-in forwards;
        }
      `}</style>
    </div>
  );
};

export default AnalysisLoadingOverlay;
