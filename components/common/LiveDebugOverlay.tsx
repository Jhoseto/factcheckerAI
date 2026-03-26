import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ScannerAnimation from './ScannerAnimation';
import AbstractBackground from './AbstractBackground';
import AnalysisLoadingStoryboard, { AnalysisCinematicCaptionsCenter } from './AnalysisLoadingStoryboard';

interface LiveDebugOverlayProps {
  visible: boolean;
  streamingProgress?: string | null;
  elapsedSeconds?: number;
}

/** След 6 мин прогресът остава 100%; таймерът расте без нулиране (07:00, 08:00…) */
const PROGRESS_CAP_SECONDS = 360;

const LiveDebugOverlay: React.FC<LiveDebugOverlayProps> = ({ visible, streamingProgress, elapsedSeconds = 0 }) => {
  const { i18n } = useTranslation();
  const isBg = i18n.language === 'bg';
  const [displayedSeconds, setDisplayedSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const prevVisibleRef = useRef(visible);

  useEffect(() => {
    const wasHidden = !prevVisibleRef.current;
    prevVisibleRef.current = visible;
    if (visible && wasHidden) {
      setDisplayedSeconds(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setDisplayedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const ext = typeof elapsedSeconds === 'number' && Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
    const total = Math.max(displayedSeconds, ext);
    setProgress(total >= PROGRESS_CAP_SECONDS ? 100 : (total / PROGRESS_CAP_SECONDS) * 100);
  }, [displayedSeconds, elapsedSeconds, visible]);

  if (!visible) return null;

  const ext = typeof elapsedSeconds === 'number' && Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  const currentSeconds = Math.max(displayedSeconds, ext);
  const totalM = Math.floor(currentSeconds / 60);
  const totalS = currentSeconds % 60;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 overflow-hidden pointer-events-auto">
      <AbstractBackground embedded />

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-8">
        <p className="text-6xl font-serif text-[#C4B091] tabular-nums tracking-tight drop-shadow-[0_2px_24px_rgba(0,0,0,0.85)] font-mono text-center">
          {String(totalM).padStart(2, '0')}
          <span className="text-[#968B74] mx-3">:</span>
          {String(totalS).padStart(2, '0')}
        </p>

        <div className="w-full max-w-md h-1.5 rounded-full bg-[#1a1a1a]/80 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#968B74] via-[#C4B091] to-[#968B74] rounded-full shadow-[0_0_12px_rgba(196,176,145,0.45)]"
            style={{
              width: `${progress}%`,
              transition: progress >= 100 ? 'none' : 'width 0.5s linear',
            }}
          />
        </div>

        <div className="hero-title-wrap relative w-full flex flex-col items-center min-h-[200px] justify-center">
          <div className="hero-blackhole-bg" aria-hidden />
          <div className="hero-saturn-ring" aria-hidden />
          <div className="relative z-10 w-full flex justify-center" style={{ width: 'min(100%, 960px)', height: 180 }}>
            <div className="absolute inset-0 flex justify-center opacity-90 mix-blend-screen pointer-events-none">
              <ScannerAnimation variant="analysis" width={480} height={180} />
            </div>
            <AnalysisCinematicCaptionsCenter visible={visible} isBg={isBg} />
          </div>
        </div>

        <AnalysisLoadingStoryboard visible={visible} streamingProgress={streamingProgress} isBg={isBg} />
      </div>
    </div>
  );
};

export default LiveDebugOverlay;
