import React from 'react';
import { useNavigate } from 'react-router-dom';

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ title, showBack, onBack, right }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <header className="flex-shrink-0 flex items-center justify-between min-h-[56px] h-14 px-4 bg-[#1a1a1a] border-b border-[#333]">
      <div className="flex items-center min-w-0 flex-1">
        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            className="mobile-tap flex items-center justify-center min-w-[44px] min-h-[44px] w-10 h-10 -ml-2 rounded-full active:bg-[#252525] touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B091]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
            aria-label="Назад"
          >
            <svg className="w-5 h-5 text-[#C4B091]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className={`text-base font-serif tracking-[0.2em] uppercase truncate text-transparent bg-clip-text bg-gradient-to-b from-[#C4B091] to-[#5E5646] ${showBack ? 'ml-1' : ''}`}>
          {title}
        </h1>
      </div>
      {right && <div className="flex-shrink-0 ml-2">{right}</div>}
    </header>
  );
};

export default MobileHeader;
