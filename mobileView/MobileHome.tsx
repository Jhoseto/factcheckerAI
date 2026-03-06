import React from 'react';
import { useTranslation } from 'react-i18next';
import MobileSafeArea from './components/MobileSafeArea';
import ScannerAnimation from '../components/common/ScannerAnimation';

const MobileHome: React.FC = () => {
  const { t } = useTranslation();
  return (
    <MobileSafeArea className="relative overflow-hidden bg-[#111]">
      {/* Animated Background Glow */}
      <div className="absolute top-[-10%] left-[-20%] w-[140%] h-[50%] bg-[#C4B091] opacity-[0.03] blur-[100px] rounded-full mix-blend-screen pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute top-[30%] right-[-30%] w-[100%] h-[60%] bg-[#968B74] opacity-[0.04] blur-[120px] rounded-full mix-blend-screen pointer-events-none animate-pulse" style={{ animationDuration: '12s' }} />

      <header className="relative z-10 flex-shrink-0 px-2 sm:px-4 pt-6 pb-6 border-b border-[#968B74]/10 bg-gradient-to-b from-[#1a1a1a]/80 to-transparent backdrop-blur-sm">
        <div className="text-center w-full flex flex-col items-center">
          <h1 className="text-[1.1rem] sm:text-xl font-serif tracking-[0.2em] sm:tracking-[0.25em] uppercase mb-1 flex items-center justify-center text-transparent bg-clip-text bg-gradient-to-b from-[#EBE5DA] via-[#C4B091] to-[#968B74] drop-shadow-lg w-full">
            <span className="relative truncate">FACTCHECKER</span>
            <span className="bg-gradient-to-br from-[#C4B091] to-[#968B74] text-[#111] px-1.5 py-0.5 ml-1 rounded text-[0.6em] tracking-normal font-black flex items-center justify-center shadow-lg flex-shrink-0">AI</span>
          </h1>
          <p className="text-[8px] font-black text-[#888] uppercase tracking-[0.3em] opacity-90">{t('nav.brandSubtitle')}</p>
        </div>
      </header>

      <main className="relative z-10 flex flex-col flex-1 px-5 pt-10 pb-12 overflow-y-auto">
        <div className="mb-8 mobile-fade-in">
          <div className="space-y-8 text-center">
            <div className="relative inline-block space-y-4">
              <h2 className="text-3xl sm:text-4xl font-serif font-black text-[#E0E0E0] tracking-tight leading-[1.15]">
                <span className="block mb-2">
                  <span className="text-[#C4B091] drop-shadow-md">{t('mobile.homeTitlePart1').charAt(0)}</span>{t('mobile.homeTitlePart1').slice(1)}
                </span>
                <span className="text-[#E0E0E0] block ml-4 relative">
                  <span className="text-[#C4B091] drop-shadow-md">{t('mobile.homeTitlePart2').charAt(0).toUpperCase()}</span>{t('mobile.homeTitlePart2').slice(1)}
                  <span className="absolute -bottom-2 left-0 w-24 h-[1px] bg-gradient-to-r from-[#968B74]/60 to-transparent" />
                </span>
              </h2>
            </div>
            <div className="space-y-5 px-2">
              <p className="text-[#ccc] text-sm leading-relaxed font-medium py-3.5 px-5 text-center mobile-glass rounded-2xl shadow-xl">
                {t('mobile.homeSubtitle')}
              </p>
              <p className="text-[#888] text-[11px] leading-relaxed text-center px-4">
                {t('mobile.homeSubtitle2')}
              </p>
            </div>
            <div className="flex justify-center items-center py-8 opacity-90 mix-blend-screen drop-shadow-2xl">
              <ScannerAnimation size={240} />
            </div>
          </div>
        </div>
      </main>
    </MobileSafeArea>
  );
};

export default MobileHome;
