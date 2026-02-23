import React from 'react';
import { Link } from 'react-router-dom';
import { renderLegalMd } from './renderLegalMd';

import privacyMd from '../../docs/privacy.md?raw';

const PrivacyPage: React.FC = () => (
    <div className="min-h-screen pt-32 pb-24 px-6 md:px-12">
        <div className="max-w-3xl mx-auto editorial-card p-8 md:p-12 bg-[#151515]/80 backdrop-blur-md">
            <div className="prose prose-invert max-w-none text-[#ddd]">
                {renderLegalMd(privacyMd)}
            </div>
            <p className="mt-12 pt-6 border-t border-[#333] text-center">
                <Link to="/" className="text-[9px] font-bold text-[#968B74] hover:text-[#C4B091] uppercase tracking-widest border-b border-[#968B74]/30">
                    Назад към началото
                </Link>
            </p>
        </div>
    </div>
);

export default PrivacyPage;
