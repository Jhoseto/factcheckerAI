/**
 * Scanner Animation Component
 * Shows a scanning animation during analysis
 */

import React from 'react';

interface ScannerAnimationProps {
    size?: number;
}

const ScannerAnimation: React.FC<ScannerAnimationProps> = ({ size = 24 }) => {
    return (
        <div 
            className="relative"
            style={{ width: size, height: size }}
        >
            <div 
                className="absolute inset-0 border-2 border-purple-500 rounded-full animate-ping"
                style={{ opacity: 0.4 }}
            ></div>
            <div 
                className="absolute inset-0 border-2 border-purple-400 rounded-full animate-pulse"
                style={{ opacity: 0.6 }}
            ></div>
            <div 
                className="absolute inset-0 border-2 border-purple-300 rounded-full"
                style={{ opacity: 0.8 }}
            ></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <div 
                    className="w-1/2 h-1/2 bg-purple-500 rounded-full animate-pulse"
                ></div>
            </div>
        </div>
    );
};

export default ScannerAnimation;
