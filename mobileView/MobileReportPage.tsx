import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAnalysisById, saveAnalysis, getAnalysisCountByType } from '../services/archiveService';
import { useAuth } from '../contexts/AuthContext';
import { finalizeBilling, synthesizeReport } from '../services/geminiService';
import {
  saveAnalysisSession,
  loadAnalysisSession,
  getCachedSynthesizedReport,
  setCachedSynthesizedReport,
  isBillingMarkedDoneClient,
  markBillingDoneClient
} from '../services/analysisSession';
import type { VideoAnalysis } from '../types';
import MobileResultView from './MobileResultView';
import MobileLinkResultView from './MobileLinkResultView';
import MobileSafeArea from './components/MobileSafeArea';
import MobileHeader from './components/MobileHeader';

const LIMITS = { video: 10, link: 15 };

const MobileReportPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, updateLocalBalance, refreshProfile } = useAuth();

  const [report, setReport] = useState<any>(null);
  const [previewAnalysis, setPreviewAnalysis] = useState<VideoAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingPayload, setBillingPayload] = useState<any>(null);
  const [isNewAnalysis, setIsNewAnalysis] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [previewType, setPreviewType] = useState<'video' | 'link'>('video');
  const [previewUrl, setPreviewUrl] = useState('');
  const billingRef = useRef(false);
  const synthRef = useRef(false);

  useEffect(() => {
    const st = location.state as { analysis?: VideoAnalysis; type?: 'video' | 'link'; url?: string; billingPayload?: unknown } | undefined;
    if (st?.analysis) {
      setPreviewAnalysis(st.analysis);
      setPreviewType(st.type || 'video');
      setPreviewUrl(st.url || '');
      const bp = st.billingPayload ?? (st.analysis as { billingPayload?: unknown })?.billingPayload;
      if (bp) setBillingPayload(bp);
      setIsNewAnalysis(true);
      saveAnalysisSession({
        analysis: st.analysis,
        billingPayload: bp,
        type: st.type || 'video',
        url: st.url || ''
      });
      setLoading(false);
      return;
    }
    const restored = loadAnalysisSession();
    if (restored?.analysis) {
      setPreviewAnalysis(restored.analysis as VideoAnalysis);
      setPreviewType(restored.type);
      setPreviewUrl(restored.url || '');
      if (restored.billingPayload) setBillingPayload(restored.billingPayload);
      setIsNewAnalysis(true);
      setLoading(false);
      return;
    }
    if (!id) {
      setError(t('report.missingReport'));
      setLoading(false);
      return;
    }
    getAnalysisById(id)
      .then((data) => {
        setReport(data || null);
        if (!data) setError(t('report.reportNotFound'));
        else {
          setIsNewAnalysis(false);
          setBillingPayload(null);
        }
      })
      .catch(() => setError(t('report.loadError')))
      .finally(() => setLoading(false));
  }, [id, location.state, t]);

  useEffect(() => {
    if (!isNewAnalysis || !billingPayload || !previewAnalysis || loading || error) return;
    const intent = billingPayload.billingIntentId as string | undefined;
    if (intent && isBillingMarkedDoneClient(intent)) {
      refreshProfile?.();
      return;
    }
    if (billingRef.current) return;
    const hasContent =
      (previewAnalysis.claims && previewAnalysis.claims.length > 0) ||
      !!(previewAnalysis.summary && (previewAnalysis.summary.overallSummary || (previewAnalysis.summary as { text?: string }).text));
    if (!hasContent) return;
    billingRef.current = true;
    finalizeBilling(billingPayload)
      .then((res) => {
        if (intent) markBillingDoneClient(intent);
        if (updateLocalBalance && res.newBalance !== undefined) updateLocalBalance(res.newBalance);
        else refreshProfile?.();
      })
      .catch((e) => {
        console.error('[MobileReport] billing:', e?.message);
        billingRef.current = false;
      });
  }, [isNewAnalysis, billingPayload, previewAnalysis, loading, error, updateLocalBalance, refreshProfile]);

  useEffect(() => {
    if (!isNewAnalysis || !previewAnalysis || previewType !== 'video' || previewAnalysis.analysisMode !== 'deep') return;
    if (previewAnalysis.synthesizedReport) return;
    const intent = billingPayload?.billingIntentId as string | undefined;
    if (!intent) return;
    if (synthRef.current) return;
    const cached = getCachedSynthesizedReport(intent);
    if (cached) {
      setPreviewAnalysis((prev) => (prev ? { ...prev, synthesizedReport: cached } : null));
      return;
    }
    synthRef.current = true;
    setReportLoading(true);
    synthesizeReport(previewAnalysis)
      .then((r) => {
        if (r) {
          setCachedSynthesizedReport(intent, r);
          setPreviewAnalysis((prev) => (prev ? { ...prev, synthesizedReport: r } : null));
        }
      })
      .catch((e) => {
        synthRef.current = false;
        console.error('[MobileReport] synth:', e?.message);
      })
      .finally(() => setReportLoading(false));
  }, [isNewAnalysis, previewAnalysis, previewType, billingPayload]);

  const handleSaveToArchive = async () => {
    if (!previewAnalysis || !currentUser) return;
    const type = previewType;
    const count = await getAnalysisCountByType(currentUser.uid, type);
    if (count >= LIMITS[type as keyof typeof LIMITS]) {
      alert(t('report.archiveLimitReached'));
      return;
    }
    try {
      const title = previewAnalysis.videoTitle || t('report.reportTitle');
      const url = previewUrl;
      const newId = await saveAnalysis(currentUser.uid, type, title, previewAnalysis, url);
      navigate(`/report/${newId}`, { replace: true });
    } catch {
      alert(t('report.saveError'));
    }
  };

  if (loading) {
    return (
      <MobileSafeArea className="flex items-center justify-center bg-[#1a1a1a] min-h-full">
        <div className="flex flex-col items-center gap-4 px-4">
          <div className="w-10 h-10 border-2 border-[#333] border-t-[#968B74] rounded-full animate-spin" />
          <p className="text-[10px] font-black text-[#C4B091] uppercase tracking-widest text-center">{t('report.loadingReport')}</p>
        </div>
      </MobileSafeArea>
    );
  }

  if (error || (!report && !previewAnalysis)) {
    return (
      <MobileSafeArea className="bg-[#1a1a1a]">
        <MobileHeader title={t('report.reportTitle')} showBack />
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 pb-24 mobile-fade-in">
          <p className="text-[#E0E0E0] text-center mb-6 text-sm">{error || t('report.invalidReport')}</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mobile-tap min-h-[44px] px-6 py-3.5 rounded-xl bg-[#968B74] text-[#1a1a1a] text-[10px] font-black uppercase tracking-[0.2em] touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B091]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] active:scale-[0.98]"
          >
            {t('report.backToHome')}
          </button>
        </div>
      </MobileSafeArea>
    );
  }

  const activeAnalysis = report ? report.analysis : previewAnalysis;
  const analysisWithId = { ...activeAnalysis, id: report?.id };
  const activeType = report ? report.type : previewType;
  const isPreview = !!previewAnalysis && !report;

  if (activeType === 'link') {
    return (
      <MobileSafeArea className="bg-[#1a1a1a]">
        <MobileLinkResultView
          analysis={analysisWithId}
          reportLoading={false}
          onSaveToArchive={isPreview ? handleSaveToArchive : undefined}
          onBack={() => navigate('/')}
        />
      </MobileSafeArea>
    );
  }

  return (
    <MobileSafeArea className="bg-[#1a1a1a]">
      <MobileResultView
        analysis={analysisWithId}
        reportLoading={reportLoading}
        onSaveToArchive={isPreview ? handleSaveToArchive : undefined}
        onBack={() => navigate('/')}
      />
    </MobileSafeArea>
  );
};

export default MobileReportPage;
