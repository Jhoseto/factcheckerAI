import React from 'react';
import { Link } from 'react-router-dom';

/** Тънка фиксирана линия долу вдясно с линкове към Правила и Поверителност (само desktop). */
const LegalFooter: React.FC = () => (
  <footer
    className="fixed bottom-0 right-0 z-50 py-2 px-4 flex gap-2 items-center justify-end"
    aria-label="Правни документи"
  >
    <Link
      to="/terms"
      className="text-[10px] font-normal text-[#968B74] hover:text-[#C4B091] transition-colors uppercase tracking-wider"
    >
      ПРАВИЛА И УСЛОВИЯ ЗА ПОЛЗВАНЕ
    </Link>
    <span className="text-[#968B74]/70">  |  </span>
    <Link
      to="/privacy"
      className="text-[10px] font-normal text-[#968B74] hover:text-[#C4B091] transition-colors uppercase tracking-wider"
    >
      ПОЛИТИКА ЗА ПОВЕРИТЕЛНОСТ
    </Link>
  </footer>
);

export default LegalFooter;
