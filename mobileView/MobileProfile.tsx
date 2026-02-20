import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MobileSafeArea from './components/MobileSafeArea';
import MobileHeader from './components/MobileHeader';

const MobileProfile: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, logout } = useAuth();

  if (!currentUser) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <MobileSafeArea>
      <MobileHeader title="Профил" />
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
                {userProfile.pointsBalance} точки
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/pricing')}
          className="mobile-tap w-full py-3 rounded-xl border-2 border-amber-900 text-amber-900 text-[10px] font-black uppercase tracking-wider mb-4"
        >
          Зареди точки
        </button>

        <button
          type="button"
          onClick={() => navigate('/expenses')}
          className="mobile-tap w-full py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider mb-4"
        >
          История на точките
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="mobile-tap w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider"
        >
          Изход
        </button>
      </main>
    </MobileSafeArea>
  );
};

export default MobileProfile;
