import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

const navItems = (profileTo: string, t: (key: string) => string): { to: string; label: string; icon: React.ReactNode; isHome?: boolean }[] => [
  {
    to: '/audit',
    label: t('mobile.audit'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: '/archive',
    label: t('nav.archive'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  {
    to: '/',
    label: '', // Home - aria-label used
    icon: (
      <svg className="w-11 h-11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    isHome: true,
  },
  {
    to: '/pricing',
    label: t('mobile.pointsNav'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: profileTo,
    label: t('mobile.profile'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

const MobileBottomNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { currentUser } = useAuth();
  const profileTo = currentUser ? '/profile' : '/login';
  const items = navItems(profileTo, t);

  const leftItems = items.filter(item => !item.isHome).slice(0, 2);
  const homeItem = items.find(item => item.isHome);
  const rightItems = items.filter(item => !item.isHome).slice(2);

  return (
    <nav
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 mobile-glass border-t border-[#968B74]/20"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-end h-[68px] px-2 pb-1">
        {/* Left side - 2 items */}
        <div className="flex items-end justify-around flex-1">
          {leftItems.map(({ to, label, icon }) => {
            const isActive = location.pathname === to || (to === '/login' && location.pathname === '/register') || (to === '/profile' && location.pathname === '/profile') || (to === '/audit' && location.pathname === '/audit');
            return (
              <NavLink
                key={to}
                to={to}
                className={`mobile-tap flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors touch-manipulation ${isActive ? 'text-[#C4B091]' : 'text-[#666]'
                  }`}
              >
                <div className={`transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(196,176,145,0.4)]' : ''}`}>
                  {icon}
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Center - Home icon */}
        {homeItem && (
          <div className="flex items-end justify-center flex-shrink-0 px-5 mb-2 relative">
            <NavLink
              to={homeItem.to}
              aria-label={t('mobile.home')}
              className={`mobile-tap flex items-center justify-center transition-all touch-manipulation relative z-10 ${location.pathname === homeItem.to ? 'text-[#1a1a1a]' : 'text-[#888]'
                }`}
            >
              <div className={`flex items-center justify-center w-[52px] h-[52px] rounded-full transition-all duration-300 shadow-lg ${location.pathname === homeItem.to
                  ? 'bg-gradient-to-tr from-[#968B74] to-[#C4B091] shadow-[0_4px_20px_rgba(196,176,145,0.4)] scale-105'
                  : 'bg-[#252525] border border-[#333] hover:border-[#968B74]/50'
                }`}>
                {/* Clone the SVG to adjust its class based on active state without hardcoding the path */}
                {React.cloneElement(homeItem.icon as React.ReactElement, {
                  className: `w-7 h-7 ${location.pathname === homeItem.to ? 'text-[#1a1a1a]' : 'text-[#ccc]'}`,
                  strokeWidth: location.pathname === homeItem.to ? 2 : 1.5
                })}
              </div>
            </NavLink>
          </div>
        )}

        {/* Right side - 2 items */}
        <div className="flex items-end justify-around flex-1">
          {rightItems.map(({ to, label, icon }) => {
            const isActive = location.pathname === to || (to === '/login' && location.pathname === '/register') || (to === '/profile' && location.pathname === '/profile') || (to === '/audit' && location.pathname === '/audit');
            return (
              <NavLink
                key={to}
                to={to}
                className={`mobile-tap flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors touch-manipulation ${isActive ? 'text-[#C4B091]' : 'text-[#666]'
                  }`}
              >
                <div className={`transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(196,176,145,0.4)]' : ''}`}>
                  {icon}
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
