import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const navItems = (profileTo: string): { to: string; label: string; icon: React.ReactNode; isHome?: boolean }[] => [
  // Left side - 2 items: Одит, Архив
  {
    to: '/audit',
    label: 'Одит',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: '/archive',
    label: 'Архив',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  // Center - Home
  {
    to: '/',
    label: '',
    icon: (
      <svg className="w-11 h-11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    isHome: true,
  },
  // Right side - 2 items: Точки, Профил
  {
    to: '/pricing',
    label: 'Точки',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: profileTo,
    label: 'Профил',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const { currentUser } = useAuth();
  const profileTo = currentUser ? '/profile' : '/login';
  const items = navItems(profileTo);

  const leftItems = items.filter(item => !item.isHome).slice(0, 2);
  const homeItem = items.find(item => item.isHome);
  const rightItems = items.filter(item => !item.isHome).slice(2);

  return (
    <nav
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a1a] border-t border-[#c9a227]/25"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
    >
      <div className="flex items-end h-16 px-2">
        {/* Left side - 2 items */}
        <div className="flex items-end justify-around flex-1">
          {leftItems.map(({ to, label, icon }) => {
            const isActive = location.pathname === to || (to === '/login' && location.pathname === '/register') || (to === '/profile' && location.pathname === '/profile') || (to === '/audit' && location.pathname === '/audit');
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors touch-manipulation ${
                  isActive ? 'text-[#c9a227]' : 'text-[#a3a3a3]'
                }`}
              >
                <span className={isActive ? 'text-[#c9a227]' : ''}>{icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Center - Home icon */}
        {homeItem && (
          <div className="flex items-end justify-center flex-shrink-0 px-4">
            <NavLink
              to={homeItem.to}
              className={`flex items-end justify-center h-full transition-all touch-manipulation relative ${
                location.pathname === homeItem.to ? 'text-[#c9a227]' : 'text-[#a3a3a3]'
              }`}
            >
              <div className={`relative -mt-1 ${location.pathname === homeItem.to ? 'scale-110' : 'scale-100'} transition-transform duration-200`}>
                <div className={`absolute inset-0 rounded-full ${location.pathname === homeItem.to ? 'bg-[#c9a227]/20' : ''} -z-10 transition-colors duration-200`} style={{ transform: 'scale(1.5)' }}></div>
                <span className={location.pathname === homeItem.to ? 'text-[#c9a227]' : ''}>{homeItem.icon}</span>
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
                className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors touch-manipulation ${
                  isActive ? 'text-[#c9a227]' : 'text-[#a3a3a3]'
                }`}
              >
                <span className={isActive ? 'text-[#c9a227]' : ''}>{icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
