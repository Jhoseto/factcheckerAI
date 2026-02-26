import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAnalysisById, saveAnalysis, getAnalysisCountByType } from '../services/archiveService';
import { useAuth } from '../contexts/AuthContext';
import MobileResultView from './MobileResultView';
import MobileLinkResultView from './MobileLinkResultView';
import MobileSafeArea from './components/MobileSafeArea';
import MobileHeader from './components/MobileHeader';

const LIMITS = { video: 10, link: 15, social: 15 };

const MobileReportPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const [report, setReport] = useState<any>(null);
  const [previewAnalysis, setPreviewAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.analysis) {
      setPreviewAnalysis(location.state.analysis);
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
      })
      .catch(() => setError(t('report.loadError')))
      .finally(() => setLoading(false));
  }, [id, location.state]);

  const handleSaveToArchive = async () => {
    if (!previewAnalysis || !currentUser) return;
    const type = location.state?.type || 'video';
    const count = await getAnalysisCountByType(currentUser.uid, type);
    if (count >= LIMITS[type as keyof typeof LIMITS]) {
      alert(t('report.archiveLimitReached'));
      return;
    }
    try {
      const title = previewAnalysis.videoTitle || 'Analysis';
      const url = location.state?.url || '';
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
  const activeType = report ? report.type : (location.state?.type || 'video');
  const isPreview = !!previewAnalysis;

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

  if (activeType === 'social') {
    return (
      <MobileSafeArea className="bg-[#1a1a1a]">
        <MobileHeader title={t('report.reportTitle')} showBack />
        <div className="p-6 pb-24 text-center text-[#ccc] text-sm mobile-fade-in">
          <p className="mb-6">{t('report.socialMobileLater')}</p>
          <button type="button" onClick={() => navigate('/')} className="mobile-tap min-h-[44px] px-6 py-3.5 rounded-xl bg-[#968B74] text-[#1a1a1a] text-[10px] font-black uppercase tracking-wider touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B091]/40 focus-visible:ring-offset-2 active:scale-[0.98]">{t('report.backToHome')}</button>
        </div>
      </MobileSafeArea>
    );
  }

  return (
    <MobileSafeArea className="bg-[#1a1a1a]">
      <MobileResultView
        analysis={analysisWithId}
        reportLoading={false}
        onSaveToArchive={isPreview ? handleSaveToArchive : undefined}
        onBack={() => navigate('/')}
      />
    </MobileSafeArea>
  );
};

export default MobileReportPage;
