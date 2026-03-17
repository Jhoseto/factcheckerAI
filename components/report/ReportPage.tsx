import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAnalysisById, saveAnalysis, getAnalysisCountByType } from '../../services/archiveService';
import { synthesizeReport, finalizeBilling } from '../../services/geminiService';
import VideoResultView from '../common/result-views/VideoResultView';
import LinkResultView from '../common/result-views/LinkResultView';
import { VideoAnalysis } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
// import { usePoints } from '../../contexts/PointsContext'; // Removed invalid import

const SLOT_LIMITS = { video: 10, link: 15 };

const ReportPage: React.FC = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { currentUser, updateLocalBalance, refreshProfile } = useAuth();

    const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
    const [type, setType] = useState<'video' | 'link'>('video');
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slotUsage, setSlotUsage] = useState<{ used: number; max: number } | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [isNewAnalysis, setIsNewAnalysis] = useState(false);
    const [billingPayload, setBillingPayload] = useState<any>(null);
    const [billingFinalized, setBillingFinalized] = useState(false);

    useEffect(() => {
        const state = location.state as { analysis?: VideoAnalysis; type?: 'video' | 'link'; url?: string } | undefined;
        if (state?.analysis && state?.type) {
            setAnalysis(state.analysis);
            setType(state.type);
            setUrl(state.url || '');
            setIsSaved(false);
            setLoading(false);
            setIsNewAnalysis(true);
            if ((state as any).billingPayload) {
                setBillingPayload((state as any).billingPayload);
            } else if ((state.analysis as any).billingPayload) {
                setBillingPayload((state.analysis as any).billingPayload);
            }

            // For fresh deep video analysis — synthesize the final report in background
            if (state.type === 'video' && state.analysis.analysisMode === 'deep' && !state.analysis.synthesizedReport) {
                setReportLoading(true);
                synthesizeReport(state.analysis)
                    .then(report => {
                        if (report) {
                            setAnalysis(prev => prev ? { ...prev, synthesizedReport: report } : null);
                        }
                    })
                    .catch(err => console.error('[ReportPage] Report synthesis failed:', err?.message))
                    .finally(() => setReportLoading(false));
            }
            return;
        }
        if (!id) {
            setError(t('report.missingId'));
            setLoading(false);
            return;
        }
        getAnalysisById(id)
            .then((report) => {
                if (!report) {
                    setError(t('report.reportNotFound'));
                    return;
                }
                // Block access if report is not public AND not owned by current user
                const isOwner = currentUser && report.userId === currentUser.uid;
                if (!report.isPublic && !isOwner) {
                    setError(t('report.notPublic'));
                    return;
                }
                const analysisWithId = { ...report.analysis, id: report.id } as VideoAnalysis;
                setAnalysis(analysisWithId);
                setType(report.type);
                setUrl(report.url || '');
                setIsSaved(true); // loaded from archive → already saved
            })
            .catch(() => setError(t('report.loadReportError')))
            .finally(() => setLoading(false));
    }, [id, location.state]);

    useEffect(() => {
        if (analysis && !loading && !error) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [analysis, loading, error]);

    // ── HITRO I TOCHNO BILLING LOGIC ─────────────────────────────────────────
    useEffect(() => {
        // Trigger billing ONLY if:
        // 1. It's a new analysis (not from archive)
        // 2. We have a billing payload
        // 3. We haven't finalized it yet
        // 4. IMPORTANT: There is actual content visible (e.g. claims or summary)
        if (isNewAnalysis && billingPayload && !billingFinalized && analysis) {
            const hasContent = (analysis.claims && analysis.claims.length > 0) || 
                               (analysis.summary && (analysis.summary.overallSummary || (analysis.summary as any).text));
            
            if (hasContent) {
                console.log('[Billing] Content detected, finalizing points deduction...');
                setBillingFinalized(true); // Prevent double calls
                finalizeBilling(billingPayload)
                    .then(res => {
                        console.log('[Billing] Success, points deducted:', res.pointsDeducted || billingPayload.points);
                        if (updateLocalBalance && res.newBalance !== undefined) {
                            updateLocalBalance(res.newBalance);
                        } else if (refreshProfile) {
                            refreshProfile();
                        }
                    })
                    .catch(err => {
                        console.error('[Billing] Failed to finalize points deduction:', err.message);
                        // We don't block the user, but log it. 
                        // If it fails, they actually got it for free (which satisfies the MUST NOT PAY ON ERROR rule)
                    });
            }
        }
    }, [analysis, isNewAnalysis, billingPayload, billingFinalized, updateLocalBalance, refreshProfile]);

    useEffect(() => {
        if (!currentUser || !type) return;
        getAnalysisCountByType(currentUser.uid, type).then((used) => {
            setSlotUsage({ used, max: SLOT_LIMITS[type] });
        });
    }, [currentUser, type]);

    const handleSaveToArchive = async () => {
        if (!analysis || !currentUser || !type) return;
        const max = SLOT_LIMITS[type];
        const used = slotUsage?.used ?? await getAnalysisCountByType(currentUser.uid, type);
        if (used >= max) {
            alert(t('report.archiveLimitReached'));
            return;
        }
        try {
            const title = (analysis as any).videoTitle || (analysis.summary as any)?.title || (type === 'video' ? 'Видео анализ' : 'Одит на статия');
            const newId = await saveAnalysis(currentUser.uid, type, title, analysis, url);
            setAnalysis((prev) => (prev ? { ...prev, id: newId } : null));
            setSlotUsage((prev) => (prev ? { ...prev, used: prev.used + 1 } : { used: 1, max }));
            setIsSaved(true);
        } catch (e: any) {
            alert(e?.message || t('report.saveError'));
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
                    <p className="text-[#888] mb-8">{error || t('report.invalidReport')}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 border border-[#333] text-[#888] text-[9px] font-bold uppercase tracking-[0.2em] hover:border-[#968B74] hover:text-[#968B74] transition-all rounded-sm"
                    >
                        {t('report.backToHome')}
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
                            {t('report.backToHome')}
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
                        {t('report.backToHome')}
                    </button>
                    <VideoResultView
                    analysis={analysis}
                    reportLoading={reportLoading}
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
