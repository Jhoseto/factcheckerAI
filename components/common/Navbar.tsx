import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';

const Navbar: React.FC = () => {
    const { currentUser, userProfile, logout } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [menuCoords, setMenuCoords] = useState({ top: 0, right: 0 });

    const handleProfileClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const willOpen = !showUserMenu;
        if (willOpen) {
            setMenuCoords({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
            });
        }
        setShowUserMenu(willOpen);
    };

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            navigate('/#' + id);
            setTimeout(() => {
                const el = document.getElementById(id);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    };

    return (
        <header className="fixed top-0 w-full z-[100] h-32 transition-all duration-700 bg-gradient-to-b from-[#222] via-[#222]/95 to-transparent backdrop-blur-md flex items-center px-10">
            <div className="w-full max-w-[1600px] mx-auto flex justify-between items-center relative">
                {/* Logo */}
                <a href="/" className="group cursor-pointer block">
                    <h1 className="text-xl md:text-2xl font-serif tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-[#C4B091] to-[#5E5646] uppercase flex items-center gap-3 transition-opacity hover:opacity-80">
                        FACTCHECKER
                        <span className="text-[9px] font-sans font-bold tracking-[0.3em] text-[#666] mt-1 opacity-60">AI</span>
                    </h1>
                    <p className="text-[7px] md:text-[8px] font-sans text-[#444] tracking-[0.15em] mt-1.5 opacity-80">
                        DEEP CONTEXTUAL GENERATIVE ENGINE (DCGE) BY SEREZLIEV | v 4.8.0
                    </p>
                </a>

                {/* Center Nav */}
                <div className="hidden md:flex gap-12 items-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <button
                        onClick={() => scrollToSection('video-analysis')}
                        className="text-[9px] font-bold tracking-[0.25em] text-[#666] hover:text-[#968B74] transition-all duration-500 uppercase relative group"
                    >
                        ВИДЕО
                        <span className="absolute -bottom-3 left-1/2 w-0 h-[1px] bg-[#968B74] transition-all duration-500 group-hover:w-full -translate-x-1/2 opacity-50"></span>
                    </button>

                    <button
                        onClick={() => scrollToSection('link-analysis')}
                        className="text-[9px] font-bold tracking-[0.25em] text-[#666] hover:text-[#968B74] transition-all duration-500 uppercase relative group"
                    >
                        ЛИНК
                        <span className="absolute -bottom-3 left-1/2 w-0 h-[1px] bg-[#968B74] transition-all duration-500 group-hover:w-full -translate-x-1/2 opacity-50"></span>
                    </button>
                </div>

                {/* Profile / Actions */}
                <div className="flex items-center gap-8">
                    {userProfile ? (
                        <>
                            <button
                                onClick={handleProfileClick}
                                className="flex items-center gap-4 text-right group focus:outline-none"
                            >
                                <div className="hidden md:block">
                                    <p className="text-[9px] font-bold text-[#968B74] uppercase tracking-[0.2em] group-hover:text-[#C4B091] transition-colors">{userProfile.displayName}</p>
                                    <p className="text-[11px] text-[#C4B091] font-bold font-mono tracking-widest mt-1">
                                        {(userProfile.pointsBalance || 0).toLocaleString()} PTS
                                    </p>
                                </div>
                                <div className="w-9 h-9 rounded-full border border-[#333] bg-[#222] flex items-center justify-center text-[#968B74] text-xs font-serif overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.5)] group-hover:border-[#968B74]/30 transition-all">
                                    {userProfile.photoURL ? <img src={userProfile.photoURL} className="w-full h-full object-cover" /> : (userProfile.displayName?.[0] || 'U')}
                                </div>
                            </button>
                            
                            {/* PORTAL: Calculated Fixed Position */}
                            {showUserMenu && createPortal(
                                <div 
                                    className="fixed inset-0 z-[9999]"
                                    onClick={() => setShowUserMenu(false)}
                                >
                                    {/* The Menu Card */}
                                    <div 
                                        style={{
                                            position: 'fixed',
                                            top: `${menuCoords.top}px`,
                                            right: `${menuCoords.right}px`,
                                        }}
                                        className="w-56 editorial-card p-3 animate-fadeUp origin-top-right shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-[#968B74]/20 bg-[#1A1A1A]/95 backdrop-blur-xl pointer-events-auto"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button onClick={() => { navigate('/pricing'); setShowUserMenu(false); }} className="w-full text-left px-4 py-3 text-[9px] font-bold text-[#968B74] uppercase tracking-[0.2em] hover:bg-[#252525] rounded transition-colors flex justify-between">
                                            Купи Точки <span className="text-[#444]">+</span>
                                        </button>
                                        <button onClick={() => { navigate('/archive'); setShowUserMenu(false); }} className="w-full text-left px-4 py-3 text-[9px] font-bold text-[#888] uppercase tracking-[0.2em] hover:bg-[#252525] rounded transition-colors hover:text-[#ddd]">
                                            Архив
                                        </button>
                                        <button onClick={() => { navigate('/expenses'); setShowUserMenu(false); }} className="w-full text-left px-4 py-3 text-[9px] font-bold text-[#888] uppercase tracking-[0.2em] hover:bg-[#252525] rounded transition-colors hover:text-[#ddd]">
                                            Разходи
                                        </button>
                                        <div className="h-[1px] bg-[#333] my-2"></div>
                                        <button onClick={() => { logout(); setShowUserMenu(false); }} className="w-full text-left px-4 py-3 text-[9px] font-bold text-[#888] hover:text-[#ddd] uppercase tracking-[0.2em] hover:bg-[#252525] rounded transition-colors">
                                            Изход
                                        </button>
                                    </div>
                                </div>,
                                document.body
                            )}
                        </>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            className="px-8 py-3 border border-[#333] text-[#888] text-[9px] font-bold tracking-[0.25em] uppercase hover:border-[#968B74] hover:text-[#968B74] transition-all rounded-sm bg-transparent hover:bg-[#968B74]/5"
                        >
                            Вход
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Navbar;
