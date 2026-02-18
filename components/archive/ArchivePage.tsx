/**
 * Archive Page
 * Shows user's past analyses
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getUserAnalyses, SavedAnalysis } from '../../services/archiveService';

const ArchivePage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'video' | 'link' | 'social'>('all');

    useEffect(() => {
        if (!user) return;

        const loadAnalyses = async () => {
            try {
                const data = await getUserAnalyses(user.uid, 100);
                setAnalyses(data);
            } catch (error) {
                console.error('[ArchivePage] Error loading analyses:', error);
            } finally {
                setLoading(false);
            }
        };

        loadAnalyses();
    }, [user]);

    const filteredAnalyses = filter === 'all' 
        ? analyses 
        : analyses.filter(a => a.type === filter);

    const formatDate = (date: any) => {
        if (!date) return '';
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString('bg-BG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'video': return '🎬';
            case 'link': return '🔗';
            case 'social': return '📱';
            default: return '📄';
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'video': return 'Видео';
            case 'link': return 'Линк';
            case 'social': return 'Социални';
            default: return 'Анализ';
        }
    };

    const getClassificationColor = (classification: string) => {
        switch (classification) {
            case 'вярно': return 'bg-green-500/20 text-green-400';
            case 'предимно вярно': return 'bg-green-400/20 text-green-300';
            case 'частично вярно': return 'bg-yellow-500/20 text-yellow-400';
            case 'подвеждащо': return 'bg-orange-500/20 text-orange-400';
            case 'невярно': return 'bg-red-500/20 text-red-400';
            case 'непроверимо': return 'bg-gray-500/20 text-gray-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                        📚 Архив на Анализи
                    </h1>
                    <p className="text-gray-300">
                        Всички ваши минали анализи на едно място
                    </p>
                </div>

                {/* Filter */}
                <div className="flex justify-center gap-2 mb-6">
                    {(['all', 'video', 'link', 'social'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                filter === f 
                                    ? 'bg-purple-600 text-white' 
                                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                            }`}
                        >
                            {f === 'all' ? 'Всички' : getTypeLabel(f)}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="text-center text-white py-12">
                        Зареждане...
                    </div>
                ) : filteredAnalyses.length === 0 ? (
                    <div className="text-center text-gray-400 py-12">
                        <p className="text-xl mb-4">Нямате запазени анализи</p>
                        <p>Направете първия си анализ!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredAnalyses.map((analysis) => (
                            <div 
                                key={analysis.id}
                                className="bg-slate-800/50 backdrop-blur rounded-xl p-4 hover:bg-slate-700/50 transition-colors cursor-pointer"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xl">{getTypeIcon(analysis.type)}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                analysis.type === 'video' ? 'bg-amber-500/20 text-amber-400' :
                                                analysis.type === 'link' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-purple-500/20 text-purple-400'
                                            }`}>
                                                {getTypeLabel(analysis.type)}
                                            </span>
                                            <span className="text-gray-500 text-sm">
                                                {formatDate(analysis.createdAt)}
                                            </span>
                                        </div>
                                        
                                        <h3 className="text-white font-medium mb-1">
                                            {analysis.title}
                                        </h3>
                                        
                                        {analysis.url && (
                                            <p className="text-gray-400 text-sm truncate mb-2">
                                                {analysis.url}
                                            </p>
                                        )}

                                        {/* Summary Stats */}
                                        {analysis.analysis?.summary && (
                                            <div className="flex items-center gap-4 text-sm">
                                                <span className="text-gray-400">
                                                    Твърдения: <span className="text-white">{analysis.analysis.claims?.length || 0}</span>
                                                </span>
                                                <span className="text-gray-400">
                                                    Доверие: <span className={`${
                                                        (analysis.analysis.summary.credibilityIndex || 0) > 0.6 ? 'text-green-400' :
                                                        (analysis.analysis.summary.credibilityIndex || 0) > 0.4 ? 'text-yellow-400' : 'text-red-400'
                                                    }`}>
                                                        {Math.round((analysis.analysis.summary.credibilityIndex || 0) * 100)}%
                                                    </span>
                                                </span>
                                                {analysis.analysis.summary.finalClassification && (
                                                    <span className={`px-2 py-0.5 rounded text-xs ${getClassificationColor(analysis.analysis.summary.finalClassification)}`}>
                                                        {analysis.analysis.summary.finalClassification}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-right text-sm text-gray-500 ml-4">
                                        <span className="block">
                                            -{analysis.analysis.pointsCost || 0} т.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Back Button */}
                <div className="mt-8 text-center">
                    <button
                        onClick={() => navigate('/')}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                        ← Към началото
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ArchivePage;
