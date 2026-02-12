import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const PointsWidget: React.FC = () => {
    const { userProfile } = useAuth();
    const navigate = useNavigate();

    if (!userProfile) return null;

    const points = userProfile.pointsBalance || 0;
    const isLowPoints = points < 100;

    return (
        <div
            className="flex items-center gap-3 px-4 py-2 bg-white border-2 border-slate-200 hover:border-amber-900 transition-all cursor-pointer group"
            onClick={() => navigate('/pricing')}
        >
            {/* Points Display */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-900 to-amber-700 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                    </svg>
                </div>

                <div className="text-left">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] leading-none">
                        Точки
                    </p>
                    <p className={`text-sm font-black tracking-tighter leading-none mt-0.5 ${isLowPoints ? 'text-red-600' : 'text-amber-900'}`}>
                        {points.toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Add Points Icon */}
            <div className="pl-2 border-l border-slate-200 group-hover:border-amber-200 transition-colors">
                <svg
                    className="w-4 h-4 text-slate-400 group-hover:text-amber-900 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
            </div>

            {/* Low Points Indicator */}
            {isLowPoints && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-white animate-pulse"></div>
            )}
        </div>
    );
};

export default PointsWidget;
