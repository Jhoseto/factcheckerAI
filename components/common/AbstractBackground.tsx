import React from 'react';
import { motion } from 'framer-motion';

const AbstractBackground: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[-1] bg-[#222222] overflow-hidden">
            {/* Base Layer: Static Satin Graphite Radial Gradient */}
            <div
                className="absolute inset-0 opacity-90"
                style={{
                    background: 'radial-gradient(circle at top center, #2C2C2C 0%, #222222 50%, #1a1a1a 100%)',
                }}
            />

            {/* SVG Noise Texture for Dithering - Vital to eliminate 8-bit banding on the base gradient */}
            <div
                className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }}
            />

            {/* Particles Container */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Fast tiny particles */}
                {[...Array(32)].map((_, i) => (
                    <motion.div
                        key={`p-${i}`}
                        className="absolute rounded-full bg-[#D4C5A5] opacity-30"
                        style={{
                            left: `${(i * 3.1 + 7) % 98}%`,
                            width: `${(i % 3) * 0.8 + 1.2}px`,
                            height: `${(i % 3) * 0.8 + 1.2}px`,
                        }}
                        initial={{ y: '100vh', scale: 0, opacity: 0 }}
                        animate={{
                            y: ['100vh', '80vh', '20vh', '0vh'],
                            scale: [0, 1, 1, 0],
                            opacity: [0, 0.5, 0.5, 0],
                        }}
                        transition={{
                            duration: 12 + (i % 6),
                            delay: (i * 0.7) % 8,
                            ease: "linear",
                            repeat: Infinity,
                        }}
                    />
                ))}

                {/* Slow glowing balloons */}
                {[...Array(24)].map((_, i) => (
                    <motion.div
                        key={`b-${i}`}
                        className="absolute rounded-full opacity-[0.35]"
                        style={{
                            background: 'radial-gradient(circle at 30% 30%, rgba(196, 176, 145, 0.5), rgba(150, 139, 116, 0.25))',
                            left: `${(i * 4.2 + 2) % 96}%`,
                            width: `${(i % 4) * 1.5 + 3}px`,
                            height: `${(i % 4) * 1.5 + 3}px`,
                        }}
                        initial={{ y: '100vh', x: 0, scale: 0.6, opacity: 0 }}
                        animate={{
                            y: ['100vh', '85vh', '40vh', '8vh', '-10vh'],
                            x: ['0vw', '2vw', '-3vw', '1vw', '0vw'],
                            scale: [0.6, 1, 1.1, 0.9, 0.5],
                            opacity: [0, 0.4, 0.5, 0.35, 0],
                        }}
                        transition={{
                            duration: 18,
                            delay: (i * 1.3) % 14,
                            ease: "easeInOut",
                            repeat: Infinity,
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default AbstractBackground;
