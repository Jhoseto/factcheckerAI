import React from 'react';
import MobileSafeArea from './components/MobileSafeArea';
import MobileHeader from './components/MobileHeader';
import FAQPage from '../components/legal/FAQPage';

const MobileFAQ: React.FC = () => {
  return (
    <MobileSafeArea className="bg-[#111]">
      <MobileHeader title="ВЪПРОСИ" />
      <div className="flex-1 overflow-y-auto overscroll-contain pb-24 mobile-faq-container">
        <style>{`
          .mobile-faq-container .pt-48 { pt-6 !important; }
          .mobile-faq-container .max-md\\:pt-32 { pt-6 !important; }
          .mobile-faq-container h1 { font-size: 2.5rem !important; line-height: 1.1 !important; margin-bottom: 1rem !important; }
          .mobile-faq-container .mb-16 { margin-bottom: 1.5rem !important; }
          .mobile-faq-container .px-8 { padding-left: 1.25rem !important; padding-right: 1.25rem !important; }
          .mobile-faq-container .pb-8 { padding-bottom: 1.25rem !important; }
          .mobile-faq-container .ml-\\[52px\\] { margin-left: 0 !important; }
          .mobile-faq-container .max-w-4xl { padding-left: 1rem !important; padding-right: 1rem !important; }
        `}</style>
        <FAQPage />
      </div>
    </MobileSafeArea>
  );
};

export default MobileFAQ;
