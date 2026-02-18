import React, { useState, useEffect } from 'react';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    shareUrl: string;
    title?: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, shareUrl, title = 'Споделете този анализ' }) => {
    const [copied, setCopied] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            document.body.style.overflow = 'unset';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isVisible && !isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
            style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/10 backdrop-blur-md transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                className={`relative bg-white w-full max-w-sm m-4 p-6 shadow-2xl transform transition-transform duration-300 editorial-card border-none ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-900 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-8 h-0.5 bg-amber-900 mx-auto mb-3"></div>
                    <h2 className="text-xl font-black text-slate-900 serif italic mb-1">{title}</h2>
                    <p className="text-xs text-slate-500 font-medium leading-tight">Публичен линк за достъп.</p>
                </div>

                {/* Link Input */}
                <div className="space-y-3">
                    <div className="relative group">
                        <input
                            type="text"
                            readOnly
                            value={shareUrl}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-600 font-mono text-xs px-3 py-3 pr-10 focus:outline-none focus:border-amber-900 transition-colors rounded-none"
                            onClick={(e) => e.currentTarget.select()}
                        />
                        <div className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center bg-slate-100 border-l border-slate-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                            </svg>
                        </div>
                    </div>

                    <button
                        onClick={handleCopy}
                        className={`w-full py-3 text-[10px] font-black uppercase tracking-widest transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 ${copied
                            ? 'bg-emerald-700 text-white'
                            : 'bg-amber-900 text-white hover:bg-black'
                            }`}
                    >
                        {copied ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                КОПИРАНО
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                КОПИРАЙ
                            </>
                        )}
                    </button>

                    <p className="text-[9px] text-center text-slate-300 font-bold uppercase tracking-widest pt-3 border-t border-slate-100">
                        Factchecker AI Secure Link
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
