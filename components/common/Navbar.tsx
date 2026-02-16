import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Navbar: React.FC = () => {
    const { currentUser, userProfile, logout } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleNewAudit = () => {
        // Force reload to clear all state
        window.location.href = '/';
    };

    return (
        <header className="py-6 md:py-10 border-b border-slate-300 mb-8 md:mb-12 flex flex-col md:flex-row justify-between items-center md:items-end print:hidden gap-6 bg-[#f9f9f9] px-4 md:px-8 max-w-[1200px] mx-auto">
            <Link to="/" className="text-center md:text-left group cursor-pointer block">
                <h1 className="text-2xl md:text-3xl font-black tracking-[calc(-0.05em)] text-slate-900 uppercase mb-0.5 serif italic text-nowrap flex items-center justify-center md:justify-start">
                    <span className="relative">
                        FACTCHECKER
                        <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-slate-200 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></span>
                    </span>
                    <span className="bg-amber-900 text-white px-1.5 py-0.5 ml-0.5 rounded-sm text-[0.6em] tracking-normal not-italic font-black flex items-center justify-center self-center h-6 shadow-sm shadow-amber-900/20">AI</span>
                </h1>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">Deep Context Generative Engine (DCGE)by Serezliev| v4.8.2</p>
            </Link>

            <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center md:items-end">

                {/* Обединен панел: Профил + Точки */}
                <div className="flex gap-4 items-center relative">
                    {userProfile && (
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-3 px-4 py-2.5 bg-white border-2 border-slate-200 hover:border-amber-900 transition-all group"
                            >
                                {/* Аватар */}
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-900 to-amber-700 flex items-center justify-center text-white font-black text-sm uppercase overflow-hidden border-2 border-slate-200 group-hover:border-amber-900 transition-all">
                                    {userProfile.photoURL ? (
                                        <img src={userProfile.photoURL} alt={userProfile.displayName} className="w-full h-full object-cover" />
                                    ) : (
                                        userProfile.displayName?.charAt(0) || 'U'
                                    )}
                                </div>

                                {/* Име */}
                                <div className="hidden md:block text-left">
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight leading-none">{userProfile.displayName}</p>
                                </div>

                                {/* Разделител */}
                                <div className="hidden md:block w-px h-6 bg-slate-200"></div>

                                {/* Точки */}
                                <div className="text-left">
                                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.15em] leading-none">Точки</p>
                                    <p className={`text-sm font-black tracking-tighter leading-none mt-0.5 ${(userProfile.pointsBalance || 0) < 100 ? 'text-red-600' : 'text-amber-900'}`}>
                                        {(userProfile.pointsBalance || 0).toLocaleString()}
                                    </p>
                                </div>

                                {/* Стрелка */}
                                <svg className={`w-4 h-4 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* Dropdown Меню */}
                            {showUserMenu && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white p-3 shadow-2xl border-2 border-slate-200 z-50 animate-fadeIn">
                                    <div className="space-y-2">
                                        {/* Инфо за мобилни */}
                                        <div className="md:hidden pb-2 border-b border-slate-100">
                                            <p className="text-xs font-black text-slate-900">{userProfile.displayName}</p>
                                            <p className="text-[9px] text-slate-500">{userProfile.email}</p>
                                        </div>

                                        {/* Купи Точки */}
                                        <button
                                            onClick={() => { navigate('/pricing'); setShowUserMenu(false); }}
                                            className="w-full p-3 bg-amber-900 text-white text-[9px] font-black uppercase tracking-[0.15em] hover:bg-amber-950 transition-all flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                            Купи Точки
                                        </button>

                                        {/* Архив */}
                                        <button
                                            onClick={() => { navigate('/expenses'); setShowUserMenu(false); }}
                                            className="w-full p-3 bg-slate-100 text-slate-900 text-[9px] font-black uppercase tracking-[0.15em] hover:bg-slate-200 transition-all flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                            </svg>
                                            Архив
                                        </button>

                                        {/* Разходи */}
                                        <button
                                            onClick={() => { navigate('/expenses'); setShowUserMenu(false); }}
                                            className="w-full p-3 bg-slate-100 text-slate-900 text-[9px] font-black uppercase tracking-[0.15em] hover:bg-slate-200 transition-all flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                            </svg>
                                            Разходи
                                        </button>

                                        {/* Разделител */}
                                        <div className="border-t border-slate-200 pt-2">
                                            <button
                                                onClick={async () => { await logout(); setShowUserMenu(false); }}
                                                className="w-full p-3 text-slate-500 text-[9px] font-black uppercase tracking-[0.15em] hover:bg-red-50 hover:text-red-600 transition-all flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                Изход
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Login/Register Button for unauthenticated users */}
                    {!currentUser && (
                        <button
                            onClick={() => navigate('/login')}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-900 text-white text-[9px] font-black uppercase tracking-[0.2em] hover:bg-amber-950 transition-all"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                            Вход
                        </button>
                    )}

                    <button onClick={handleNewAudit} className="bg-slate-900 text-white px-5 py-2 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all">НОВ ОДИТ</button>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
