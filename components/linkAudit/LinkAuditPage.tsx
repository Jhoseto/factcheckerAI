import React, { useState } from 'react';
import { analyzeLinkDeep } from '../../services/linkAudit/linkService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { validateNewsUrl } from '../../services/validation';
import AnalysisLoadingOverlay from '../common/AnalysisLoadingOverlay';

const LinkAuditPage: React.FC = () => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { currentUser, userProfile, updateLocalBalance, refreshProfile } = useAuth();

    const handleStartAnalysis = async () => {
        if (!url.trim()) return;
        
        const validation = validateNewsUrl(url);
        if (!validation.valid) {
            setError('Моля, въведете валиден URL адрес.');
            return;
        }

        if (!currentUser) {
            navigate('/login');
            return;
        }

        const estimatedCost = 5; 
        if (userProfile && userProfile.pointsBalance < estimatedCost) {
            setError(`Недостатъчно точки. Необходими са ${estimatedCost}.`);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await analyzeLinkDeep(url);
            navigate('/analysis-result', { state: { analysis: result.analysis, type: 'link', url } });

            if (result.usage?.newBalance !== undefined) {
                updateLocalBalance(result.usage.newBalance);
            } else {
                refreshProfile();
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Възникна грешка при анализа на линка.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section id="link-analysis" className="relative py-24 z-10">
            <AnalysisLoadingOverlay visible={loading} />
            {/* Divider (Same as Video Section) */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#968B74]/20 to-transparent"></div>

            <div className="max-w-5xl mx-auto px-6 text-center animate-fadeUp">
                
                {/* Header (Identical structure to Video Section) */}
                <div className="mb-12 space-y-4">
                    <div className="flex items-center justify-center gap-4 opacity-50">
                        <div className="h-[1px] w-12 bg-[#968B74]"></div>
                        <span className="text-[10px] font-bold text-[#C4B091] uppercase tracking-[0.4em]">Текстови Анализ</span>
                        <div className="h-[1px] w-12 bg-[#968B74]"></div>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-serif text-[#E0E0E0]">
                        Одит на Статия
                    </h2>
                </div>

                {/* Card Container (Identical to Video Section) */}
                <div className="max-w-3xl mx-auto editorial-card p-4 md:p-6 bg-[#2E2E2E]/80 backdrop-blur-xl">
                    <div className="relative flex flex-col md:flex-row items-center gap-4 p-2">
                        <input
                            type="url"
                            placeholder="https://news-site.bg/article/..."
                            className="input-luxury w-full flex-1 px-6 py-4 rounded text-sm placeholder:text-[#666] tracking-wide"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleStartAnalysis()}
                            disabled={loading}
                        />
                        <button
                            onClick={handleStartAnalysis}
                            disabled={loading || !url.trim()}
                            className="btn-luxury-solid w-full md:w-auto px-10 py-4 rounded text-[10px] uppercase tracking-[0.2em] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Анализ...' : 'ИЗПЪЛНИ'}
                        </button>
                    </div>
                    
                    {error && <p className="text-red-400 text-xs tracking-wide mt-4 font-bold p-3 bg-red-900/10 rounded border border-red-900/20">{error}</p>}
                </div>

            </div>
        </section>
    );
};

export default LinkAuditPage;
