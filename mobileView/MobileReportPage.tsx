import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getAnalysisById, saveAnalysis, getAnalysisCountByType } from '../services/archiveService';
import { useAuth } from '../contexts/AuthContext';
import MobileResultView from './MobileResultView';
import MobileSafeArea from './components/MobileSafeArea';
import MobileHeader from './components/MobileHeader';

const LIMITS = { video: 10, link: 15, social: 15 };

const MobileReportPage: React.FC = () => {
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
      setError('Липсва доклад.');
      setLoading(false);
      return;
    }
    getAnalysisById(id)
      .then((data) => {
        setReport(data || null);
        if (!data) setError('Докладът не е намерен.');
      })
      .catch(() => setError('Грешка при зареждане.'))
      .finally(() => setLoading(false));
  }, [id, location.state]);

  const handleSaveToArchive = async () => {
    if (!previewAnalysis || !currentUser) return;
    const type = location.state?.type || 'video';
    const count = await getAnalysisCountByType(currentUser.uid, type);
    if (count >= LIMITS[type as keyof typeof LIMITS]) {
      alert('Достигнахте лимита за този тип. Изтрийте стари анализи.');
      return;
    }
    try {
      const title = previewAnalysis.videoTitle || 'Analysis';
      const url = location.state?.url || '';
      const newId = await saveAnalysis(currentUser.uid, type, title, previewAnalysis, url);
      navigate(`/report/${newId}`, { replace: true });
    } catch {
      alert('Грешка при запазване.');
    }
  };

  if (loading) {
    return (
      <MobileSafeArea className="flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-slate-300 border-t-amber-900 rounded-full animate-spin" />
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Зареждане на доклад</p>
        </div>
      </MobileSafeArea>
    );
  }

  if (error || (!report && !previewAnalysis)) {
    return (
      <MobileSafeArea>
        <MobileHeader title="Доклад" showBack />
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 mobile-fade-in">
          <p className="text-slate-600 text-center mb-6 text-sm">{error || 'Невалиден доклад.'}</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mobile-tap px-6 py-3.5 rounded-xl bg-amber-900 text-white text-[10px] font-black uppercase tracking-[0.2em] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-900/30 focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            Към началото
          </button>
        </div>
      </MobileSafeArea>
    );
  }

  const activeAnalysis = report ? report.analysis : previewAnalysis;
  const analysisWithId = { ...activeAnalysis, id: report?.id };
  const activeType = report ? report.type : (location.state?.type || 'video');
  const isPreview = !!previewAnalysis;

  if (activeType !== 'video') {
    return (
      <MobileSafeArea>
        <MobileHeader title="Доклад" showBack />
        <div className="p-6 text-center text-slate-600 text-sm mobile-fade-in">
          <p className="mb-4">Мобилният изглед за линк/социален анализ може да се добави по-късно. Отворете на desktop за пълен доклад.</p>
          <button type="button" onClick={() => navigate('/')} className="mobile-tap px-6 py-3 rounded-xl bg-amber-900 text-white text-[10px] font-black uppercase tracking-wider active:scale-[0.98]">Към началото</button>
        </div>
      </MobileSafeArea>
    );
  }

  return (
    <MobileSafeArea className="bg-[#fafafa]">
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
