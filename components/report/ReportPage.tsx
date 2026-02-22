import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getAnalysisById, saveAnalysis, getAnalysisCountByType } from '../../services/archiveService';
import VideoResultView from '../common/result-views/VideoResultView';
import LinkResultView from '../common/result-views/LinkResultView';
import { VideoAnalysis } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const SLOT_LIMITS = { video: 10, link: 15, social: 15 };

const ReportPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { currentUser } = useAuth();

    const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
    const [type, setType] = useState<'video' | 'link' | 'social'>('video');
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slotUsage, setSlotUsage] = useState<{ used: number; max: number } | null>(null);
    // True only when the report has been saved to Firestore (not just from Gemini with a temp UUID)
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        const state = location.state as { analysis?: VideoAnalysis; type?: 'video' | 'link' | 'social'; url?: string } | undefined;
        if (state?.analysis && state?.type) {
            setAnalysis(state.analysis);
            setType(state.type);
            setUrl(state.url || '');
            setIsSaved(false); // fresh analysis, not yet saved
            setLoading(false);
            return;
        }
        if (!id) {
            setError('Липсва идентификатор на доклада.');
            setLoading(false);
            return;
        }
        getAnalysisById(id)
            .then((report) => {
                if (!report) {
                    setError('Докладът не е намерен.');
                    return;
                }
                // Block access if report is not public AND not owned by current user
                const isOwner = currentUser && report.userId === currentUser.uid;
                if (!report.isPublic && !isOwner) {
                    setError('Докладът не е публичен. Само собственикът може да го отвори.');
                    return;
                }
                const analysisWithId = { ...report.analysis, id: report.id } as VideoAnalysis;
                setAnalysis(analysisWithId);
                setType(report.type);
                setUrl(report.url || '');
                setIsSaved(true); // loaded from archive → already saved
            })
            .catch(() => setError('Грешка при зареждане на доклада.'))
            .finally(() => setLoading(false));
    }, [id, location.state]);

    useEffect(() => {
        if (!currentUser || !type || type === 'social') return;
        getAnalysisCountByType(currentUser.uid, type).then((used) => {
            setSlotUsage({ used, max: SLOT_LIMITS[type] });
        });
    }, [currentUser, type]);

    const handleSaveToArchive = async () => {
        if (!analysis || !currentUser || !type || type === 'social') return;
        const max = SLOT_LIMITS[type];
        const used = slotUsage?.used ?? await getAnalysisCountByType(currentUser.uid, type);
        if (used >= max) {
            alert('Достигнахте лимита за този тип анализи. Изтрийте стари от архива.');
            return;
        }
        try {
            const title = (analysis as any).videoTitle || (analysis.summary as any)?.title || (type === 'video' ? 'Видео анализ' : 'Одит на статия');
            const newId = await saveAnalysis(currentUser.uid, type, title, analysis, url);
            setAnalysis((prev) => (prev ? { ...prev, id: newId } : null));
            setSlotUsage((prev) => (prev ? { ...prev, used: prev.used + 1 } : { used: 1, max }));
            setIsSaved(true);
        } catch (e: any) {
            alert(e?.message || 'Грешка при запазване.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#121212] flex items-center justify-center">
                <div className="w-16 h-16 border-[1px] border-[#333] border-t-[#968B74] rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !analysis) {
        return (
            <div className="min-h-screen relative overflow-hidden pt-40 pb-24">
                <div className="premium-bg-wrapper">
                    <div className="premium-wave-1" />
                    <div className="premium-wave-2" />
                    <div className="premium-wave-3" />
                    <div className="premium-texture" />
                </div>
                <div className="max-w-2xl mx-auto px-6 relative z-10 text-center">
                    <p className="text-[#888] mb-8">{error || 'Невалиден доклад.'}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 border border-[#333] text-[#888] text-[9px] font-bold uppercase tracking-[0.2em] hover:border-[#968B74] hover:text-[#968B74] transition-all rounded-sm"
                    >
                        Към началото
                    </button>
                </div>
            </div>
        );
    }

    if (type === 'social') {
        return (
            <div className="min-h-screen relative overflow-hidden pt-40 pb-24">
                <div className="premium-bg-wrapper">
                    <div className="premium-wave-1" />
                    <div className="premium-wave-2" />
                    <div className="premium-wave-3" />
                    <div className="premium-texture" />
                </div>
                <div className="max-w-2xl mx-auto px-6 relative z-10 text-center">
                    <p className="text-[#888] mb-8">Изгледът за социален анализ не е наличен за този доклад.</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 border border-[#333] text-[#888] text-[9px] font-bold uppercase tracking-[0.2em] hover:border-[#968B74] hover:text-[#968B74] transition-all rounded-sm"
                    >
                        Към началото
                    </button>
                </div>
            </div>
        );
    }

    if (type === 'link') {
        return (
            <>
                <div className="min-h-screen relative pt-32 pb-24">
                    <div className="premium-bg-wrapper">
                        <div className="premium-wave-1" />
                        <div className="premium-wave-2" />
                        <div className="premium-wave-3" />
                        <div className="premium-texture" />
                    </div>
                    <div className="w-full max-w-[1600px] mx-auto px-10 relative z-10 animate-fadeUp pt-4">
                        <button
                            onClick={() => navigate('/')}
                            className="mb-6 flex items-center gap-3 text-[9px] font-bold text-[#666] uppercase tracking-[0.2em] hover:text-[#968B74] transition-colors group"
                        >
                            <span className="w-4 h-[1px] bg-[#666] group-hover:bg-[#968B74] transition-colors" />
                            Обратно към началото
                        </button>
                        <LinkResultView
                            analysis={analysis}
                            url={url}
                            price={analysis.pointsCost ?? 0}
                            onSave={!isSaved ? handleSaveToArchive : undefined}
                            isSaved={isSaved}
                            onReset={() => navigate('/')}
                            slotUsage={slotUsage ?? undefined}
                        />
                    </div>
                </div>
            </>
        );
    }

    return (
        <div className="min-h-screen relative pt-32 pb-24">
            <div className="premium-bg-wrapper">
                <div className="premium-wave-1" />
                <div className="premium-wave-2" />
                <div className="premium-wave-3" />
                <div className="premium-texture" />
            </div>
            <div className="w-full max-w-[1600px] mx-auto px-10 relative z-10 animate-fadeUp pt-4">
                <button
                    onClick={() => navigate('/')}
                    className="mb-6 flex items-center gap-3 text-[9px] font-bold text-[#666] uppercase tracking-[0.2em] hover:text-[#968B74] transition-colors group"
                >
                    <span className="w-4 h-[1px] bg-[#666] group-hover:bg-[#968B74] transition-colors" />
                    Обратно към началото
                </button>
                <VideoResultView
                    analysis={analysis}
                    reportLoading={false}
                    onSaveToArchive={!isSaved ? handleSaveToArchive : undefined}
                    isSaved={isSaved}
                    onReset={() => navigate('/')}
                    slotUsage={slotUsage ?? undefined}
                />
            </div>
        </div>
    );
};

export default ReportPage;
