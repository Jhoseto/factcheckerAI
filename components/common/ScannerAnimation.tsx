/**
 * Scanner Animation Component
 * "The Neural Weave" - Abstract, seamless, organic data visualization in Brand Colors.
 * Features: Amber-900 neural nodes, floating connections, blur-reveal typography.
 */

import React, { useEffect, useState } from 'react';

interface ScannerAnimationProps {
    size?: number;
    className?: string;
}

const ScannerAnimation: React.FC<ScannerAnimationProps> = ({ size = 320, className = '' }) => {
    // Simplified version for small interactive elements
    if (size < 80) {
        return (
            <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
                <div className="absolute inset-0 bg-transparent"></div>
                {/* Micro version of the neural node */}
                <div className="absolute w-2 h-2 bg-amber-900/40 rounded-full animate-pulse"></div>
                <div className="absolute w-full h-full border border-amber-900/10 rounded-full animate-[spin_4s_linear_infinite]"></div>
            </div>
        );
    }

    const [activeWordIndex, setActiveWordIndex] = useState(0);
    const words = [
        'РАЗБИРАНЕ',
        'СВЪРЗАНОСТ',
        'ДЪЛБОЧИНА',
        'ЛОГИКА',
        'СМИСЪЛ'
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveWordIndex((prev) => (prev + 1) % words.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Generate static random positions for nodes to avoid hydration mismatch/jitter
    // In a real app we might use a seeded random, but fixed values work best for reliable UI
    const nodes = [
        { top: '20%', left: '30%', delay: '0s' },
        { top: '70%', left: '20%', delay: '1s' },
        { top: '40%', left: '80%', delay: '2s' },
        { top: '80%', left: '70%', delay: '3s' },
        { top: '15%', left: '60%', delay: '4s' },
    ];

    return (
        <div
            className={`relative flex items-center justify-center overflow-visible ${className}`}
            style={{ width: size, height: size }}
        >
            {/* 1. Background Neural Network (The "Brain") */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Connecting lines via abstract rotation */}
                <div className="absolute top-1/2 left-1/2 w-[120%] h-[1px] bg-gradient-to-r from-transparent via-amber-900/10 to-transparent -translate-x-1/2 -translate-y-1/2 rotate-45 animate-pulse"></div>
                <div className="absolute top-1/2 left-1/2 w-[120%] h-[1px] bg-gradient-to-r from-transparent via-amber-900/10 to-transparent -translate-x-1/2 -translate-y-1/2 -rotate-12 animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 w-[120%] h-[1px] bg-gradient-to-r from-transparent via-amber-900/10 to-transparent -translate-x-1/2 -translate-y-1/2 rotate-90 animate-pulse" style={{ animationDelay: '2s' }}></div>

                {/* Floating Nodes */}
                {nodes.map((node, i) => (
                    <div
                        key={i}
                        className="absolute w-2 h-2 bg-amber-900/20 rounded-full blur-[1px] animate-[float_6s_ease-in-out_infinite]"
                        style={{ top: node.top, left: node.left, animationDelay: node.delay }}
                    >
                        {/* Connecting pulse */}
                        <div className="absolute inset-0 bg-amber-900/30 rounded-full animate-ping"></div>
                    </div>
                ))}
            </div>

            {/* 2. Abstract "Understanding" Symbol (Central Ripple) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[1px] h-[1px] rounded-full border border-amber-900/20 animate-[ripple_4s_linear_infinite]"></div>
                <div className="w-[1px] h-[1px] rounded-full border border-amber-900/10 animate-[ripple_4s_linear_infinite]" style={{ animationDelay: '1s' }}></div>
                <div className="w-[1px] h-[1px] rounded-full border border-amber-900/05 animate-[ripple_4s_linear_infinite]" style={{ animationDelay: '2s' }}></div>
            </div>

            {/* 3. Typography Reveal */}
            <div className="relative z-10 flex flex-col items-center justify-center">
                <div className="h-10 flex items-center justify-center overflow-hidden">
                    {words.map((word, i) => (
                        <div
                            key={word}
                            className={`absolute font-serif font-medium tracking-[0.25em] text-amber-950/90 transition-all duration-[3000ms] ease-in-out
                                ${i === activeWordIndex
                                    ? 'opacity-100 blur-0 scale-100 translate-y-0'
                                    : 'opacity-0 blur-xl scale-95 translate-y-4'}
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

            {/* Global Keyframes */}
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(10px, -10px); }
                }
                @keyframes ripple {
                    0% { width: 0; height: 0; opacity: 0.8; }
                    100% { width: 100%; height: 100%; opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default ScannerAnimation;
