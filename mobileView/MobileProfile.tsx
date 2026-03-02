import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSwitch } from '../hooks/useLanguageSwitch';
import MobileSafeArea from './components/MobileSafeArea';
import MobileHeader from './components/MobileHeader';

const MobileProfile: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, userProfile, logout } = useAuth();
  const { language, setLanguage, isTranslating } = useLanguageSwitch();

  if (!currentUser) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <MobileSafeArea className="bg-[#1a1a1a]">
      <MobileHeader title={t('mobile.profile')} />
      <main className="flex flex-col flex-1 px-4 pb-24 overflow-y-auto overscroll-contain">
        <div className="rounded-xl p-4 mb-4 flex items-center gap-4 bg-[#252525] border border-[#333]">
          <div className="w-14 h-14 rounded-full bg-[#968B74] flex items-center justify-center text-[#1a1a1a] font-black text-xl uppercase shrink-0">
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              userProfile?.displayName?.charAt(0) || currentUser.email?.charAt(0) || '?'
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#E0E0E0] truncate">{userProfile?.displayName || t('mobile.user')}</p>
            <p className="text-xs text-[#888] truncate">{currentUser.email}</p>
            {userProfile?.pointsBalance != null && (
              <p className="text-[10px] font-black text-[#C4B091] uppercase tracking-wider mt-1">
                {userProfile.pointsBalance} {t('mobile.points')}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setLanguage('bg')} disabled={isTranslating} className={`flex-1 min-h-[44px] py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider border-2 touch-manipulation ${language === 'bg' ? 'border-[#968B74] text-[#C4B091] bg-[#968B74]/20' : 'border-[#333] text-[#888]'}`}>BG</button>
          <button type="button" onClick={() => setLanguage('en')} disabled={isTranslating} className={`flex-1 min-h-[44px] py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider border-2 touch-manipulation ${language === 'en' ? 'border-[#968B74] text-[#C4B091] bg-[#968B74]/20' : 'border-[#333] text-[#888]'}`}>ENG</button>
        </div>

        <button
          type="button"
          onClick={() => navigate('/pricing')}
          className="mobile-tap w-full min-h-[44px] py-3.5 rounded-xl border-2 border-[#968B74] text-[#C4B091] text-[10px] font-black uppercase tracking-wider mb-4 touch-manipulation"
        >
          {t('mobile.loadPoints')}
        </button>

        <button
          type="button"
          onClick={() => navigate('/expenses')}
          className="mobile-tap w-full min-h-[44px] py-3.5 rounded-xl border-2 border-[#333] text-[#ccc] text-[10px] font-black uppercase tracking-wider mb-4 touch-manipulation bg-[#252525]"
        >
          {t('mobile.pointsHistory')}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="mobile-tap w-full min-h-[44px] py-3.5 rounded-xl bg-[#252525] border border-[#333] text-[#ccc] text-[10px] font-black uppercase tracking-wider mb-6 touch-manipulation"
        >
          {t('mobile.logout')}
        </button>

        <p className="text-[10px] font-normal text-[#C4B091]/90 flex flex-wrap gap-0 justify-center items-center mt-2">
          <Link to="/terms" className="hover:text-[#C4B091] transition-colors uppercase tracking-wider py-2">{t('legal.terms')}</Link>
          <span className="text-[#666] mx-1">  |  </span>
          <Link to="/privacy" className="hover:text-[#C4B091] transition-colors uppercase tracking-wider py-2">{t('legal.privacy')}</Link>
        </p>
      </main>
    </MobileSafeArea>
  );
};

export default MobileProfile;
