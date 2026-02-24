import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslatedReport } from '../../hooks/useTranslatedReport';
import LegalModal from '../legal/LegalModal';
import termsMd from '../../docs/terms.md?raw';
import privacyMd from '../../docs/privacy.md?raw';

/** Тънка фиксирана линия долу вдясно с линкове към Правила и Поверителност (само desktop). Отваря модали; затварят се при клик отвън. */
const LegalFooter: React.FC = () => {
  const { t } = useTranslation();
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const { displayText: termsText, loading: termsLoading } = useTranslatedReport('legal_terms', termsMd);
  const { displayText: privacyText, loading: privacyLoading } = useTranslatedReport('legal_privacy', privacyMd);

  return (
    <>
      <footer
        className="fixed bottom-0 right-0 z-50 py-2 px-4 flex gap-2 items-center justify-end"
        aria-label={t('legal.ariaLabel')}
      >
        <button
          type="button"
          onClick={() => setTermsOpen(true)}
          className="text-[10px] font-normal text-[#968B74] hover:text-[#C4B091] transition-colors uppercase tracking-wider bg-transparent border-none cursor-pointer"
        >
          {t('legal.terms')}
        </button>
        <span className="text-[#968B74]/70">  |  </span>
        <button
          type="button"
          onClick={() => setPrivacyOpen(true)}
          className="text-[10px] font-normal text-[#968B74] hover:text-[#C4B091] transition-colors uppercase tracking-wider bg-transparent border-none cursor-pointer"
        >
          {t('legal.privacy')}
        </button>
      </footer>

      <LegalModal
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        title={t('legal.terms')}
        content={termsText}
        loading={termsLoading}
      />
      <LegalModal
        isOpen={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title={t('legal.privacy')}
        content={privacyText}
        loading={privacyLoading}
      />
    </>
  );
};

export default LegalFooter;
