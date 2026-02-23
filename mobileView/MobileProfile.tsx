import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSwitch } from '../hooks/useLanguageSwitch';
import MobileSafeArea from './components/MobileSafeArea';
import MobileHeader from './components/MobileHeader';

const MobileProfile: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, logout } = useAuth();
  const { t } = useTranslation();
  const { language, setLanguage, isTranslating } = useLanguageSwitch();

  if (!currentUser) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <MobileSafeArea>
      <MobileHeader title={t('mobile.profile')} />
      <main className="flex flex-col flex-1 px-4 pb-8 overflow-y-auto">
        <div className="mobile-editorial-card rounded-xl p-4 mb-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-900 flex items-center justify-center text-white font-black text-xl uppercase">
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              userProfile?.displayName?.charAt(0) || currentUser.email?.charAt(0) || '?'
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-900 truncate">{userProfile?.displayName || 'Потребител'}</p>
            <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
            {userProfile?.pointsBalance != null && (
              <p className="text-[10px] font-black text-amber-900 uppercase tracking-wider mt-1">
                {userProfile.pointsBalance} {t('mobile.points')}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setLanguage('bg')} disabled={isTranslating} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border-2 ${language === 'bg' ? 'border-amber-900 text-amber-900 bg-amber-50' : 'border-slate-200 text-slate-600'}`}>BG</button>
          <button type="button" onClick={() => setLanguage('en')} disabled={isTranslating} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border-2 ${language === 'en' ? 'border-amber-900 text-amber-900 bg-amber-50' : 'border-slate-200 text-slate-600'}`}>ENG</button>
        </div>

        <button
          type="button"
          onClick={() => navigate('/pricing')}
          className="mobile-tap w-full py-3 rounded-xl border-2 border-amber-900 text-amber-900 text-[10px] font-black uppercase tracking-wider mb-4"
        >
          {t('mobile.loadPoints')}
        </button>

        <button
          type="button"
          onClick={() => navigate('/expenses')}
          className="mobile-tap w-full py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider mb-4"
        >
          {t('mobile.pointsHistory')}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="mobile-tap w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider mb-6"
        >
          {t('mobile.logout')}
        </button>

        <p className="text-[10px] font-normal text-amber-900/90 flex flex-wrap gap-0 justify-center items-center mt-2">
          <Link to="/terms" className="hover:text-amber-900 transition-colors uppercase tracking-wider">ПРАВИЛА И УСЛОВИЯ ЗА ПОЛЗВАНЕ</Link>
          <span className="text-amber-900/60 mx-1">  |  </span>
          <Link to="/privacy" className="hover:text-amber-900 transition-colors uppercase tracking-wider">ПОЛИТИКА ЗА ПОВЕРИТЕЛНОСТ</Link>
        </p>
      </main>
    </MobileSafeArea>
  );
};

export default MobileProfile;
