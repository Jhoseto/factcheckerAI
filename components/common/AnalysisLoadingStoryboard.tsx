import React, { useEffect, useState } from 'react';
import {
  ANALYSIS_CINEMATIC_BG,
  ANALYSIS_CINEMATIC_EN,
  CINEMATIC_CAPTION_INTERVAL_MS,
  CINEMATIC_FADE_MS,
} from './analysisOverlayCaptions';

interface AnalysisLoadingStoryboardProps {
  visible: boolean;
  streamingProgress?: string | null;
  isBg: boolean;
  compact?: boolean;
}

/** Само един ред live статус от API — под графиката */
const AnalysisLoadingStoryboard: React.FC<AnalysisLoadingStoryboardProps> = (props) => {
  const { visible, streamingProgress, compact } = props;
  const stream = streamingProgress?.trim();
  if (!visible || !stream) return null;

  return (
    <div className={`flex flex-col items-center w-full ${compact ? 'max-w-[min(100%,20rem)]' : 'max-w-2xl'}`}>
      <div className="w-full overflow-x-auto overflow-y-hidden text-center analysis-loading-status-scroll">
        <p
          className={`whitespace-nowrap inline-block text-[#C4B091] font-serif tracking-wide drop-shadow-[0_2px_16px_rgba(0,0,0,0.9)] ${
            compact ? 'text-[11px] px-1' : 'text-sm md:text-base px-2'
          }`}
        >
          {stream}
        </p>
      </div>

      <style>{`
        .analysis-loading-status-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(150, 139, 116, 0.4) transparent;
          -webkit-overflow-scrolling: touch;
        }
        .analysis-loading-status-scroll::-webkit-scrollbar {
          height: 4px;
        }
        .analysis-loading-status-scroll::-webkit-scrollbar-thumb {
          background: rgba(150, 139, 116, 0.45);
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
};

export default AnalysisLoadingStoryboard;

/** Кинематографични надписи в центъра на сканера — много плавен fade (~2.5s), смяна на 5s */
export const AnalysisCinematicCaptionsCenter: React.FC<{
  visible: boolean;
  isBg: boolean;
  compact?: boolean;
}> = ({ visible, isBg, compact }) => {
  const lines = isBg ? ANALYSIS_CINEMATIC_BG : ANALYSIS_CINEMATIC_EN;
  const [captionIndex, setCaptionIndex] = useState(0);
  const fadeSec = CINEMATIC_FADE_MS / 1000;

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setCaptionIndex((i) => (i + 1) % lines.length);
    }, CINEMATIC_CAPTION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [visible, lines.length]);

  useEffect(() => {
    if (visible) setCaptionIndex(0);
  }, [visible]);

  if (!visible) return null;

  const ease = 'cubic-bezier(0.45, 0.05, 0.55, 0.95)';

  return (
    <div
      className="absolute inset-0 z-[35] flex items-center justify-center pointer-events-none px-1 sm:px-2"
      aria-live="polite"
    >
      <div className="relative w-full max-w-[min(100%,56rem)] min-h-[2.25rem] sm:min-h-[2.5rem]">
        {lines.map((line, i) => (
          <div
            key={i}
            className="absolute inset-0 flex items-center justify-center overflow-x-auto overflow-y-hidden analysis-caption-row-scroll"
            style={{
              opacity: i === captionIndex ? 1 : 0,
              filter: compact
                ? 'none'
                : i === captionIndex
                  ? 'blur(0px)'
                  : 'blur(4px)',
              transitionProperty: compact ? 'opacity' : 'opacity, filter',
              transitionDuration: `${fadeSec}s`,
              transitionTimingFunction: ease,
              pointerEvents: 'none',
            }}
          >
            <p
              className={`whitespace-nowrap font-serif text-[#E8DCC8] px-3 ${
                compact ? 'text-[13px] leading-none' : 'text-sm sm:text-[15px] md:text-base leading-none'
              }`}
              style={{
                transform:
                  i === captionIndex ? 'translateY(calc(-1em + 0px))' : 'translateY(calc(-1em + 8px))',
                transition: `transform ${fadeSec}s ${ease}`,
                textShadow:
                  '0 0 24px rgba(0,0,0,0.98), 0 2px 12px rgba(0,0,0,0.9), 0 0 1px rgba(196,176,145,0.35)',
              }}
            >
              {line}
            </p>
          </div>
        ))}
      </div>

      <style>{`
        .analysis-caption-row-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(150, 139, 116, 0.35) transparent;
          -webkit-overflow-scrolling: touch;
        }
        .analysis-caption-row-scroll::-webkit-scrollbar {
          height: 3px;
        }
        .analysis-caption-row-scroll::-webkit-scrollbar-thumb {
          background: rgba(150, 139, 116, 0.4);
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
};
