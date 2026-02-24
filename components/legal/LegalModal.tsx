import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { renderLegalMd } from './renderLegalMd';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  loading?: boolean;
}

/** Модал за Правила/Поверителност: затваря се при клик на backdrop (само desktop). */
const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, title, content, loading }) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop — клик затваря */}
      <div className="absolute inset-0 bg-black/5 backdrop-blur-sm" onClick={onClose} />
      {/* Съдържание — клик не затваря */}
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto editorial-card p-8 md:p-12 bg-[#151515]/95 backdrop-blur-md border border-[#968B74]/20 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-[#666] hover:text-[#C4B091] transition-colors rounded"
          aria-label={t('common.close')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {loading && <p className="text-[#968B74] text-sm mb-4">{t('loading.translating')}</p>}
        <div className="prose prose-invert max-w-none text-[#ddd] pr-8">
          {renderLegalMd(content)}
        </div>
        <p className="mt-12 pt-6 border-t border-[#333] text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-[9px] font-bold text-[#968B74] hover:text-[#C4B091] uppercase tracking-widest border-b border-[#968B74]/30"
          >
            {t('legal.backHome')}
          </button>
        </p>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default LegalModal;
