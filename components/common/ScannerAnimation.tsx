/**
 * Scanner Animation Component
 * "The Neural Weave" - Abstract, seamless, organic data visualization in Brand Colors.
 * Features: Amber-900 neural nodes, floating connections, blur-reveal typography.
 */

import React, { useEffect, useState } from 'react';

interface ScannerAnimationProps {
    size?: number;
    width?: number;
    height?: number;
    className?: string;
}

const ScannerAnimation: React.FC<ScannerAnimationProps> = ({ size = 320, width, height, className = '' }) => {
    const w = width ?? size;
    const h = height ?? size;

    // Simplified version for small interactive elements
    if (size < 80) {
        return (
            <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
                <div className="absolute inset-0 bg-transparent"></div>
                {/* Micro version of the neural node */}
                <div className="absolute w-2 h-2 bg-[#968B74]/40 rounded-full animate-pulse"></div>
                <div className="absolute w-full h-full border border-[#968B74]/10 rounded-full animate-[spin_4s_linear_infinite]"></div>
            </div>
        );
    }

    const [activeWordIndex, setActiveWordIndex] = useState(0);
    const words = [
        'РАЗБИРАНЕ',
        'СВЪРЗАНОСТ',
        'ДЪЛБОЧИНА',
        'ЛОГИКА',
        'ПОЗИЦИЯ',
        'МАНИПУЛАЦИЯ',
        'ОРИЕНТИРИ',
        'ВЕРИФИКАЦИЯ',
        'СМИСЪЛ'
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveWordIndex((prev) => (prev + 1) % words.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const nodes = [
        { top: '20%', left: '25%', delay: '0s' },
        { top: '75%', left: '22%', delay: '2.1s' },
        { top: '40%', left: '78%', delay: '4.3s' },
        { top: '78%', left: '75%', delay: '1.4s' },
        { top: '48%', left: '38%', delay: '3.7s' },
    ];

    const dataDots = [
        { top: '12%', left: '50%', delay: '0s' },
        { top: '85%', left: '48%', delay: '2.2s' },
        { top: '48%', left: '10%', delay: '4.4s' },
        { top: '50%', left: '88%', delay: '1.1s' },
    ];

    return (
        <div
            className={`relative flex items-center justify-center overflow-visible ${className}`}
            style={{ width: w, height: h }}
        >
            {/* 0. Grid + scan line + corner accents */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 border border-[#968B74]/30 rounded-full scanner-grid-pulse opacity-60" style={{ animationDelay: '0s' }}></div>
                <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#968B74]/25 to-transparent scanner-line-glow" style={{ animationDelay: '0.8s' }}></div>
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#968B74]/25 to-transparent scanner-line-glow" style={{ animationDelay: '1.6s' }}></div>
                <div className="absolute inset-0 scanner-sweep-line" />
                <div className="absolute top-0 left-1/2 w-16 h-px bg-gradient-to-r from-transparent via-[#968B74]/40 to-transparent -translate-x-1/2 scanner-corner-accent" style={{ animationDelay: '0s' }} />
                <div className="absolute bottom-0 left-1/2 w-20 h-px bg-gradient-to-r from-transparent via-[#968B74]/35 to-transparent -translate-x-1/2 scanner-corner-accent" style={{ animationDelay: '1.5s' }} />
            </div>

            {/* Orbiting micro-dots – 3 точки, появяват се и изчезват до минимум */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="scanner-orbit-dots" style={{ width: '70%', height: '70%', position: 'relative' }}>
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="absolute left-1/2 top-1/2 w-0 h-1/2 origin-top" style={{ transform: `rotate(${i * 120}deg)`, marginLeft: 0 }}>
                            <div className="absolute bottom-0 left-1/2 w-1 h-1 rounded-full bg-[#968B74]/40 -ml-0.5 scanner-dot-appear" style={{ animationDelay: `${i * 1.4}s` }} />
                        </div>
                    ))}
                </div>
            </div>

            {/* 1. Neural lines */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 w-[140%] h-[1px] bg-gradient-to-r from-transparent via-[#968B74]/12 to-transparent -translate-x-1/2 -translate-y-1/2 rotate-45 scanner-line-glow" style={{ animationDelay: '0s' }}></div>
                <div className="absolute top-1/2 left-1/2 w-[140%] h-[1px] bg-gradient-to-r from-transparent via-[#968B74]/12 to-transparent -translate-x-1/2 -translate-y-1/2 -rotate-12 scanner-line-glow" style={{ animationDelay: '1.2s' }}></div>
                <div className="absolute top-1/2 left-1/2 w-[140%] h-[1px] bg-gradient-to-r from-transparent via-[#968B74]/12 to-transparent -translate-x-1/2 -translate-y-1/2 rotate-90 scanner-line-glow" style={{ animationDelay: '2.4s' }}></div>

                {/* Data dots – 4 точки, появяват се и изчезват */}
                {dataDots.map((d, i) => (
                    <div key={`dot-${i}`} className="absolute w-1.5 h-1.5 rounded-full bg-[#C4B091]/40 scanner-dot-float scanner-dot-appear" style={{ top: d.top, left: d.left, animationDelay: d.delay }} />
                ))}

                {/* Nodes: изчезват напълно и се появяват с различни забавяния */}
                {nodes.map((node, i) => (
                    <div
                        key={i}
                        className="absolute w-3 h-3 scanner-node-appear"
                        style={{ top: node.top, left: node.left, animationDelay: node.delay }}
                    >
                        <div className="absolute inset-0 scanner-node-float">
                            <div className="absolute inset-0 rounded-full bg-[#968B74]/30 scanner-node-glow" style={{ boxShadow: '0 0 10px rgba(150,139,116,0.25)' }} />
                            <div className="absolute inset-0 rounded-full border-2 border-[#968B74]/50 scanner-node-pulse-ring" style={{ transformOrigin: 'center' }} />
                            <div className="absolute inset-0.5 rounded-full bg-[#C4B091]/70 scanner-node-core" style={{ transformOrigin: 'center' }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* 2. Central Ripple - smooth scale + fade */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="scanner-ripple rounded-full border border-[#968B74]/25" style={{ animationDelay: '0s' }}></div>
                <div className="scanner-ripple rounded-full border border-[#968B74]/15" style={{ animationDelay: '2s' }}></div>
                <div className="scanner-ripple rounded-full border border-[#968B74]/10" style={{ animationDelay: '4s' }}></div>
            </div>

            {/* 3. Typography Reveal */}
            <div className="relative z-10 flex flex-col items-center justify-center">
                <div className="h-10 flex items-center justify-center overflow-hidden">
                    {words.map((word, i) => (
                        <div
                            key={word}
                            className={`absolute font-serif font-medium tracking-[0.25em] text-[#C4B091]/90 transition-all duration-[2000ms] ease-[cubic-bezier(0.4,0,0.2,1)]
                                ${i === activeWordIndex
                                    ? 'opacity-100 blur-0 scale-100 translate-y-0'
                                    : 'opacity-0 blur-md scale-95 translate-y-2'}
                            `}
                            style={{
                                textShadow: '0 0 20px rgba(255,255,255,0.8)' // Allow text to read over any busy background
                            }}
                        >
                            {word}
                        </div>
                    ))}
                </div>
            </div>

            {/* Premium smooth keyframes */}
            <style>{`
                @keyframes scannerLineGlow {
                    0%, 100% { opacity: 0.35; }
                    50% { opacity: 0.75; }
                }
                @keyframes scannerGridPulse {
                    0%, 100% { opacity: 0.04; transform: scale(1); }
                    50% { opacity: 0.1; transform: scale(1.02); }
                }
                @keyframes scannerNodeFloat {
                    0%, 100% { transform: translate(0, 0); }
                    25% { transform: translate(5px, -6px); }
                    50% { transform: translate(-4px, -9px); }
                    75% { transform: translate(6px, -4px); }
                }
                @keyframes scannerNodeAppear {
                    0%, 100% { opacity: 0; transform: translate(0,0) scale(0.6); }
                    15% { opacity: 1; transform: translate(0,0) scale(1); }
                    85% { opacity: 1; transform: translate(0,0) scale(1); }
                }
                @keyframes scannerNodeGlow {
                    0%, 100% { opacity: 0.5; filter: brightness(1); }
                    50% { opacity: 1; filter: brightness(1.2); }
                }
                @keyframes scannerNodePulseRing {
                    0% { transform: scale(1); opacity: 0.6; border-width: 1px; }
                    100% { transform: scale(3); opacity: 0; border-width: 0.5px; }
                }
                @keyframes scannerNodeCore {
                    0%, 100% { opacity: 0.7; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.15); }
                }
                @keyframes scannerDotFloat {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(3px, -4px); }
                }
                @keyframes scannerDotAppear {
                    0%, 100% { opacity: 0.06; transform: translate(0,0) scale(0.7); }
                    20% { opacity: 0.9; transform: translate(0,0) scale(1); }
                    80% { opacity: 0.9; transform: translate(0,0) scale(1); }
                }
                @keyframes scannerSweepLine {
                    0% { opacity: 0; transform: translateX(-50%); }
                    5% { opacity: 0.6; }
                    95% { opacity: 0.6; }
                    100% { opacity: 0; transform: translateX(150%); }
                }
                @keyframes scannerCornerAccent {
                    0%, 100% { opacity: 0.2; }
                    50% { opacity: 0.7; }
                }
                @keyframes scannerOrbitRotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes scannerRipple {
                    0% { transform: scale(0); opacity: 0.5; }
                    100% { transform: scale(1.4); opacity: 0; }
                }
                .scanner-line-glow { animation: scannerLineGlow 4s ease-in-out infinite; }
                .scanner-grid-pulse { animation: scannerGridPulse 5s ease-in-out infinite; }
                .scanner-node-float { animation: scannerNodeFloat 9s ease-in-out infinite; }
                .scanner-node-appear { animation: scannerNodeAppear 6s ease-in-out infinite; }
                .scanner-node-glow { animation: scannerNodeGlow 2.5s ease-in-out infinite; }
                .scanner-node-pulse-ring {
                    animation: scannerNodePulseRing 2.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
                    transform-origin: center;
                }
                .scanner-node-core { animation: scannerNodeCore 2s ease-in-out infinite; }
                .scanner-dot-float { animation: scannerDotFloat 5s ease-in-out infinite; }
                .scanner-dot-appear { animation: scannerDotAppear 5s ease-in-out infinite; }
                .scanner-sweep-line {
                    background: linear-gradient(90deg, transparent, rgba(150,139,116,0.12), transparent);
                    width: 40%; height: 1px;
                    animation: scannerSweepLine 8s linear infinite;
                    position: absolute; top: 50%; left: 0;
                }
                .scanner-corner-accent { animation: scannerCornerAccent 3s ease-in-out infinite; }
                .scanner-orbit-dots {
                    position: absolute;
                    animation: scannerOrbitRotate 22s linear infinite;
                }
                .scanner-ripple {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    animation: scannerRipple 6s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
                }
            `}</style>
        </div>
    );
};

export default ScannerAnimation;
