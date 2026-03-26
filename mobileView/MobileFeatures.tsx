import React from 'react';
import MobileSafeArea from './components/MobileSafeArea';
import MobileHeader from './components/MobileHeader';
import FeaturesPage from '../components/legal/FeaturesPage';

const MobileFeatures: React.FC = () => {
  return (
    <MobileSafeArea className="bg-[#111]">
      <MobileHeader title="ВЪЗМОЖНОСТИ" />
      <div className="flex-1 overflow-y-auto overscroll-contain pb-24 mobile-features-container">
        <style>{`
          .mobile-features-container .pt-48 { pt-6 !important; }
          .mobile-features-container .max-md\\:pt-32 { pt-6 !important; }
          .mobile-features-container h1 { font-size: 2.5rem !important; line-height: 1.1 !important; margin-bottom: 1rem !important; }
          .mobile-features-container .mb-24 { margin-bottom: 2rem !important; }
          .mobile-features-container .mb-32 { margin-bottom: 3rem !important; }
          .mobile-features-container .p-8 { padding: 1.5rem !important; }
          .mobile-features-container .p-12 { padding: 1.5rem !important; }
          .mobile-features-container .grid-cols-4 { grid-template-columns: 1fr !important; }
          .mobile-features-container .grid-cols-3 { grid-template-columns: 1fr !important; }
          .mobile-features-container .max-w-6xl { padding-left: 1rem !important; padding-right: 1rem !important; }
        `}</style>
        <FeaturesPage />
      </div>
    </MobileSafeArea>
  );
};

export default MobileFeatures;
