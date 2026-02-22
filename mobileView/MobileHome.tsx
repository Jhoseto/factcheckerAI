import React from 'react';
import MobileSafeArea from './components/MobileSafeArea';
import ScannerAnimation from '../components/common/ScannerAnimation';

const MobileHome: React.FC = () => {
  return (
    <MobileSafeArea>
      <header className="flex-shrink-0 px-4 pt-4 pb-6 bg-white border-b border-slate-200">
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-[-0.05em] text-slate-900 uppercase mb-0.5 serif italic flex items-center justify-center">
            <span className="relative">
              FACTCHECKER
            </span>
            <span className="bg-amber-900 text-white px-1.5 py-0.5 ml-0.5 rounded-sm text-[0.6em] tracking-normal not-italic font-black flex items-center justify-center self-center h-6 shadow-sm shadow-amber-900/20">AI</span>
          </h1>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-80">Deep Context Generative Engine (DCGE) by Serezliev | v4.8.2</p>
        </div>
      </header>
      <main className="flex flex-col flex-1 px-4 pt-6 pb-8 overflow-y-auto">
        {/* Hero Section */}
        <div className="mb-8 mobile-fade-in">
          <div className="space-y-6 text-center">
            <div className="relative inline-block space-y-3">
              <h2 className="text-4xl font-black text-slate-900 tracking-[-0.02em] leading-[0.9] serif italic">
                <span className="block mb-1">
                  <span className="text-amber-900">О</span>дит на
                </span>
                <span className="text-slate-900 block ml-4 relative">
                  <span className="text-amber-900">И</span>стината
                  <span className="absolute -bottom-1 left-0 w-24 h-[1px] bg-slate-200"></span>
                </span>
              </h2>
            </div>
            <div className="space-y-4 -mx-4 px-4">
              <p className="text-slate-800 text-base leading-relaxed font-semibold serif italic py-2 px-4 text-center bg-white/50 backdrop-blur-sm border-[0.5px] border-amber-900/15 rounded-sm">
                Професионална рамка за комплексен структурен анализ на информационни активи и верификация на фактически твърдения.
              </p>
              <p className="text-slate-500 text-xs leading-relaxed text-center font-medium opacity-80">
                Чрез внедрената архитектура на технологията DCGE се извършва безпристрастна диагностика на източниците, осигуряваща математическа точност при дефинирането на достоверност.
              </p>
            </div>
            {/* Scanner Animation */}
            <div className="flex justify-center items-center py-8">
              <ScannerAnimation size={320} />
            </div>
          </div>
        </div>
      </main>
    </MobileSafeArea>
  );
};

export default MobileHome;
