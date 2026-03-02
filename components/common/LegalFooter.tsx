import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const LegalFooter: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer
      className="fixed bottom-0 right-0 z-50 py-2 px-4 flex gap-2 items-center justify-end flex-wrap"
      aria-label={t('legal.ariaLabel')}
    >
      <Link
        to="/terms"
        className="text-[10px] font-normal text-[#968B74] hover:text-[#C4B091] transition-colors uppercase tracking-wider"
      >
        {t('legal.terms')}
      </Link>
      <span className="text-[#968B74]/70">|</span>
      <Link
        to="/privacy"
        className="text-[10px] font-normal text-[#968B74] hover:text-[#C4B091] transition-colors uppercase tracking-wider"
      >
        {t('legal.privacy')}
      </Link>
      <span className="text-[#968B74]/70">|</span>
      <Link
        to="/refund-policy"
        className="text-[10px] font-normal text-[#968B74] hover:text-[#C4B091] transition-colors uppercase tracking-wider"
      >
        {t('legal.refund')}
      </Link>
      <span className="text-[#968B74]/70">|</span>
      <a
        href="mailto:factcheckerai42@gmail.com"
        className="text-[10px] font-normal text-[#968B74] hover:text-[#C4B091] transition-colors"
      >
        factcheckerai42@gmail.com
      </a>
    </footer>
  );
};

export default LegalFooter;
