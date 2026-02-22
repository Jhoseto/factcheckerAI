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
    <header className="flex-shrink-0 flex items-center justify-between h-14 px-4 bg-[#1a1a1a] border-b border-[#c9a227]/25 safe-area-top">
      <div className="flex items-center min-w-0 flex-1">
        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            className="mobile-tap flex items-center justify-center w-10 h-10 -ml-2 rounded-full active:bg-[#2c2c2c] touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
            aria-label="Назад"
          >
            <svg className="w-5 h-5 text-[#c9a227]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className={`text-base font-black text-[#f5f5f5] truncate uppercase tracking-tight serif italic ${showBack ? 'ml-1' : ''}`}>
          {title}
        </h1>
      </div>
      {right && <div className="flex-shrink-0 ml-2">{right}</div>}
    </header>
  );
};

export default MobileHeader;
