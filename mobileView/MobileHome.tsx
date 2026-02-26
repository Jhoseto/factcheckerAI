import React from 'react';
import { useTranslation } from 'react-i18next';
import MobileSafeArea from './components/MobileSafeArea';
import ScannerAnimation from '../components/common/ScannerAnimation';

const MobileHome: React.FC = () => {
  const { t } = useTranslation();
  return (
    <MobileSafeArea>
      <header className="flex-shrink-0 px-4 pt-4 pb-6 bg-[#1a1a1a] border-b border-[#968B74]/25">
        <div className="text-center">
          <h1 className="text-2xl font-serif tracking-[0.2em] uppercase mb-0.5 flex items-center justify-center text-transparent bg-clip-text bg-gradient-to-b from-[#C4B091] to-[#5E5646]">
            <span className="relative">FACTCHECKER</span>
            <span className="bg-[#968B74] text-[#1a1a1a] px-1.5 py-0.5 ml-0.5 rounded-sm text-[0.6em] tracking-normal font-black flex items-center justify-center self-center h-6">AI</span>
          </h1>
          <p className="text-[9px] font-bold text-[#888] uppercase tracking-widest opacity-80">{t('nav.brandSubtitle')}</p>
        </div>
      </header>
      <main className="flex flex-col flex-1 px-4 pt-6 pb-10 overflow-y-auto">
        <div className="mb-8 mobile-fade-in">
          <div className="space-y-6 text-center">
            <div className="relative inline-block space-y-3">
              <h2 className="text-3xl sm:text-4xl font-serif font-black text-[#E0E0E0] tracking-tight leading-tight">
                <span className="block mb-1">
                  <span className="text-[#C4B091]">{t('mobile.homeTitlePart1').charAt(0)}</span>{t('mobile.homeTitlePart1').slice(1)}
                </span>
                <span className="text-[#E0E0E0] block ml-2 sm:ml-4 relative">
                  <span className="text-[#C4B091]">{t('mobile.homeTitlePart2').charAt(0).toUpperCase()}</span>{t('mobile.homeTitlePart2').slice(1)}
                  <span className="absolute -bottom-1 left-0 w-20 sm:w-24 h-[1px] bg-[#968B74]/40" />
                </span>
              </h2>
            </div>
            <div className="space-y-4 px-1">
              <p className="text-[#ccc] text-sm sm:text-base leading-relaxed font-medium py-3 px-4 text-center bg-[#252525] border border-[#333] rounded-lg">
                {t('mobile.homeSubtitle')}
              </p>
              <p className="text-[#888] text-xs leading-relaxed text-center">
                {t('mobile.homeSubtitle2')}
              </p>
            </div>
            <div className="flex justify-center items-center py-6 sm:py-8">
              <ScannerAnimation size={220} />
            </div>
          </div>
        </div>
      </main>
    </MobileSafeArea>
  );
};

export default MobileHome;
