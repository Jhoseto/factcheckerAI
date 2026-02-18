import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { getAnalysisById, saveAnalysis, SavedAnalysis, getAnalysisCountByType } from '../../services/archiveService';
import VideoResultView from '../common/result-views/VideoResultView';
import LinkResultView from '../common/result-views/LinkResultView';
import SocialResultView from '../common/result-views/SocialResultView';
import ScannerAnimation from '../common/ScannerAnimation';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../contexts/AuthContext';

const LIMITS = {
    video: 10,
    link: 15,
    social: 15
};

const ReportPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser } = useAuth();

    const [report, setReport] = useState<SavedAnalysis | null>(null);
    const [previewAnalysis, setPreviewAnalysis] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slotUsage, setSlotUsage] = useState<{ used: number, max: number }>({ used: 0, max: 0 });

    useEffect(() => {
        // Fetch slot usage if in preview mode
        const checkSlots = async () => {
            if (!currentUser) return;
            const type = location.state?.type || 'video';
            const count = await getAnalysisCountByType(currentUser.uid, type);
            setSlotUsage({ used: count, max: LIMITS[type as keyof typeof LIMITS] });
        };

        if (location.state && location.state.analysis) {
            checkSlots();
            setPreviewAnalysis(location.state.analysis);
            setLoading(false);
            return;
        }

        // Option 2: Archived Mode (fetch by ID)
        const fetchReport = async () => {
            if (!id) {
                navigate('/');
                return;
            }
            try {
                const data = await getAnalysisById(id);
                if (data) {
                    setReport(data);
                } else {
                    setError('Докладът не е намерен.');
                }
            } catch (err) {
                console.error(err);
                setError('Грешка при зареждане на доклада.');
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [id, location.state, navigate, currentUser]);

    const handleSaveToArchive = async () => {
        if (!previewAnalysis || !currentUser) return;

        try {
            const type = location.state?.type || 'video';

            // Re-check limit before saving
            const currentCount = await getAnalysisCountByType(currentUser.uid, type);
            if (currentCount >= LIMITS[type as keyof typeof LIMITS]) {
                alert('Достигнали сте лимита за този тип анализи. Изтрийте стари анализи, за да запазите нови.');
                return;
            }

            const title = previewAnalysis.videoTitle || 'Analysis Report';
            const url = location.state?.url || '';

            const newId = await saveAnalysis(
                currentUser.uid,
                type,
                title,
                previewAnalysis,
                url
            );

            navigate(`/report/${newId}`, { replace: true });

        } catch (err) {
            console.error("Failed to save", err);
            alert("Грешка при запазване. Моля опитайте отново.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#f9f9f9]">
                <ScannerAnimation size={60} />
                <p className="mt-4 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">
                    ЗАРЕЖДАНЕ НА ДОКЛАД #{id?.substring(0, 8)}...
                </p>
            </div>
        );
    }

    if (error || (!report && !previewAnalysis)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f9f9f9] px-4">
                <div className="text-center space-y-6 max-w-lg">
                    <div className="text-6xl">😕</div>
                    <h2 className="text-2xl font-black text-slate-900 serif italic">{error || 'Невалиден линк'}</h2>
                    <p className="text-slate-600">
                        Този доклад не съществува или е бил изтрит.
                    </p>
                    <Link to="/" className="inline-block px-8 py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-colors">
                        Към Началото
                    </Link>
                </div>
            </div>
        );
    }

    // Determine what to display
    const activeAnalysis = report ? report.analysis : previewAnalysis;
    const activeType = report ? report.type : (location.state?.type || 'video');
    const isPreview = !!previewAnalysis;

    // Inject ID if it exists in report, otherwise it's undefined (Preview)
    const analysisWithId = { ...activeAnalysis, id: report?.id };

    const pageTitle = report?.title || activeAnalysis.videoTitle || 'Factchecker AI Report';
    const pageDescription = activeAnalysis.summary?.overallSummary?.substring(0, 160) || 'Професионален анализ на медийно съдържание с Factchecker AI.';

    return (
        <div className="min-h-screen bg-[#f9f9f9] pt-20">
            <Helmet>
                <title>{pageTitle} | Factchecker AI</title>
                <meta name="description" content={pageDescription} />

                {/* Open Graph / Facebook */}
                <meta property="og:type" content="article" />
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={pageDescription} />
                <meta property="og:image" content="https://factchecker.ai/og-image.jpg" /> {/* Replace with actual OG image URL or dynamic generation */}
                <meta property="og:url" content={window.location.href} />
                <meta property="og:site_name" content="Factchecker AI" />

                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={pageTitle} />
                <meta name="twitter:description" content={pageDescription} />
                <meta name="twitter:image" content="https://factchecker.ai/og-image.jpg" />
            </Helmet>

            {/* Public Header Overlay/Banner could go here */}

            {activeType === 'video' && (
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <VideoResultView
                        analysis={analysisWithId}
                        reportLoading={false}
                        onSaveToArchive={isPreview ? handleSaveToArchive : undefined}
                        onReset={() => navigate('/')}
                        slotUsage={isPreview ? slotUsage : undefined}
                    />
                </div>
            )}

            {activeType === 'link' && (
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <LinkResultView
                        analysis={analysisWithId}
                        url={report?.url || ''}
                        price={activeAnalysis.pointsCost || 0}
                        onSave={isPreview ? handleSaveToArchive : undefined}
                        onReset={() => navigate('/')}
                        slotUsage={isPreview ? slotUsage : undefined}
                    />
                </div>
            )}

            {activeType === 'social' && (
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <SocialResultView
                        result={analysisWithId}
                        onReset={() => navigate('/')}
                        onSave={isPreview ? handleSaveToArchive : undefined}
                        slotUsage={isPreview ? slotUsage : undefined}
                    />
                </div>
            )}

            {!isPreview && (
                <footer className="py-12 text-center text-slate-400 border-t border-slate-200 mt-12 bg-white">
                    <p className="text-[9px] font-black uppercase tracking-widest mb-2">Генерирано от Factchecker AI</p>
                    <Link to="/" className="text-[10px] font-bold text-amber-900 hover:text-amber-700 uppercase tracking-wider">
                        Направете свой собствен анализ
                    </Link>
                </footer>
            )}
        </div>
    );
};

export default ReportPage;
