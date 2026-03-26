import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ScannerAnimation from '../../components/common/ScannerAnimation';
import AbstractBackground from '../../components/common/AbstractBackground';
import AnalysisLoadingStoryboard, {
  AnalysisCinematicCaptionsCenter,
} from '../../components/common/AnalysisLoadingStoryboard';

interface MobileLiveDebugOverlayProps {
  visible: boolean;
  streamingProgress?: string | null;
  elapsedSeconds?: number;
}

const PROGRESS_CAP_SECONDS = 360;

const MobileLiveDebugOverlay: React.FC<MobileLiveDebugOverlayProps> = ({
  visible,
  streamingProgress,
  elapsedSeconds = 0,
}) => {
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
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center p-4 overflow-hidden pointer-events-auto">
      <AbstractBackground embedded />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6">
        <p className="text-5xl font-serif text-[#C4B091] tabular-nums tracking-tight drop-shadow-[0_2px_20px_rgba(0,0,0,0.85)] font-mono text-center">
          {String(totalM).padStart(2, '0')}
          <span className="text-[#968B74] mx-2">:</span>
          {String(totalS).padStart(2, '0')}
        </p>

        <div className="w-full h-1 rounded-full bg-[#1a1a1a]/80 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#968B74] via-[#C4B091] to-[#968B74] rounded-full shadow-[0_0_10px_rgba(196,176,145,0.4)]"
            style={{
              width: `${progress}%`,
              transition: progress >= 100 ? 'none' : 'width 0.5s linear',
            }}
          />
        </div>

        <div className="hero-title-wrap relative w-full flex flex-col items-center min-h-[160px] justify-center">
          <div className="hero-blackhole-bg" aria-hidden />
          <div className="hero-saturn-ring" aria-hidden />
          <div className="relative z-10 w-full max-w-[340px] flex justify-center" style={{ height: 150 }}>
            <div className="absolute inset-0 flex justify-center opacity-90 mix-blend-screen pointer-events-none">
              <ScannerAnimation variant="analysis" width={320} height={150} />
            </div>
            <AnalysisCinematicCaptionsCenter visible={visible} isBg={isBg} compact />
          </div>
        </div>

        <AnalysisLoadingStoryboard visible={visible} streamingProgress={streamingProgress} isBg={isBg} compact />
      </div>
    </div>
  );
};

export default MobileLiveDebugOverlay;
