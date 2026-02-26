import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { renderLegalMd } from './renderLegalMd';
import { useTranslatedReport } from '../../hooks/useTranslatedReport';

import privacyMd from '../../docs/privacy.md?raw';

const PrivacyPage: React.FC = () => {
    const { t } = useTranslation();
    const { displayText, loading } = useTranslatedReport('legal_privacy', privacyMd);

    return (
        <div className="min-h-screen pt-32 pb-24 px-6 md:px-12 max-md:pt-20 max-md:pb-28 max-md:px-4">
            <div className="max-w-3xl mx-auto editorial-card p-8 md:p-12 max-md:p-6 bg-[#151515]/80 backdrop-blur-md">
                {loading && <p className="text-[#968B74] text-sm mb-4">{t('common.translating')}</p>}
                <div className="prose prose-invert max-w-none text-[#ddd]">
                    {renderLegalMd(displayText)}
                </div>
                <p className="mt-12 pt-6 border-t border-[#333] text-center">
                    <Link to="/" className="text-[9px] font-bold text-[#968B74] hover:text-[#C4B091] uppercase tracking-widest border-b border-[#968B74]/30">
                        {t('legal.backHome')}
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default PrivacyPage;
