
import { CostEstimate, AnalysisMode } from '../types';

// Pricing per 1M tokens (as of 2026)
const PRICING = {
    'gemini-3-flash-preview': {
        input: 1.25,
        output: 5.00
    },
    'gemini-3-flash-preview-batch': {
        input: 0.625, // 50% discount
        output: 2.50  // 50% discount
    }
};

/**
 * Estimate tokens for video analysis based on duration
 */
export const estimateVideoTokens = (durationSeconds: number): number => {
    // Based on research:
    // - Audio: 32 tokens/second = 1,920 tokens/minute
    // - Video frames: ~2,500 tokens/minute (sampling)
    // Total: ~4,420 tokens/minute for full video analysis

    const minutes = durationSeconds / 60;
    const audioTokens = minutes * 1920;
    const videoTokens = minutes * 2500;
    const totalTokens = audioTokens + videoTokens;

    return Math.round(totalTokens);
};

/**
 * Estimate tokens for transcript-only analysis
 */
export const estimateTranscriptTokens = (durationSeconds: number): number => {
    // Average speaking rate: ~150 words/minute
    // Average tokens per word: ~1.3
    // Plus prompt overhead: ~2,000 tokens

    const minutes = durationSeconds / 60;
    const words = minutes * 150;
    const textTokens = words * 1.3;
    const promptTokens = 2000;
    const outputTokens = 3000; // Estimated analysis output

    return Math.round(textTokens + promptTokens + outputTokens);
};

/**
 * Calculate cost estimate for a given mode and video duration
 */
export const calculateCostEstimate = (
    mode: AnalysisMode,
    durationSeconds: number
): CostEstimate => {
    let estimatedTokens: number;
    let estimatedCostUSD: number;
    let estimatedTime: string;
    let features: string[];

    switch (mode) {
        case 'quick':
            estimatedTokens = estimateTranscriptTokens(durationSeconds);
            // Calculate actual cost based on tokens
            estimatedCostUSD = (estimatedTokens / 1_000_000) * PRICING['gemini-3-flash-preview'].input;
            estimatedTime = '5-10 секунди';
            features = [
                'Анализ само на текст/транскрипция',
                'Извличане на твърдения и факти',
                'Логически анализ',
                'Най-ниска цена за бърза проверка'
            ];
            break;

        case 'batch':
            estimatedTokens = estimateVideoTokens(durationSeconds);
            const batchInputCost = (estimatedTokens / 1_000_000) * PRICING['gemini-3-flash-preview-batch'].input;
            const batchOutputCost = (5000 / 1_000_000) * PRICING['gemini-3-flash-preview-batch'].output;
            estimatedCostUSD = batchInputCost + batchOutputCost;
            estimatedTime = '2-5 минути';
            features = [
                'Пълен анализ на видео + аудио',
                'Визуален анализ (body language, графики)',
                'Тонален анализ (емоции, интонация)',
                '50% по-евтино от Standard режим'
            ];
            break;

        case 'standard':
            estimatedTokens = estimateVideoTokens(durationSeconds);
            const standardInputCost = (estimatedTokens / 1_000_000) * PRICING['gemini-3-flash-preview'].input;
            const standardOutputCost = (5000 / 1_000_000) * PRICING['gemini-3-flash-preview'].output;
            estimatedCostUSD = standardInputCost + standardOutputCost;
            estimatedTime = '30-60 секунди';
            features = [
                'Пълен анализ на видео + аудио',
                'Визуален анализ (body language, графики)',
                'Тонален анализ (емоции, интонация)',
                'Най-бърз резултат'
            ];
            break;
    }

    return {
        mode,
        estimatedTokens,
        estimatedCostUSD: Math.max(0, estimatedCostUSD), // Ensure non-negative
        estimatedTime,
        features
    };
};

/**
 * Get all cost estimates for a video
 */
export const getAllCostEstimates = (durationSeconds: number): Record<AnalysisMode, CostEstimate> => {
    return {
        quick: calculateCostEstimate('quick', durationSeconds),
        batch: calculateCostEstimate('batch', durationSeconds),
        standard: calculateCostEstimate('standard', durationSeconds)
    };
};
