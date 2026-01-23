
import { CostEstimate, AnalysisMode } from '../types';
import { GEMINI_PRICING, calculateCost } from './pricing';

/**
 * Estimate tokens for video analysis based on duration
 * Based on Gemini API documentation and real-world usage:
 * - Video processing: ~2,500 tokens/minute (sampling frames)
 * - Audio processing: ~1,920 tokens/minute (32 tokens/second)
 * - Prompt overhead: ~3,000 tokens (detailed analysis prompt)
 * - Output tokens: ~5,000-8,000 tokens (detailed JSON response)
 */
export const estimateVideoTokens = (durationSeconds: number): { input: number; output: number } => {
    const minutes = durationSeconds / 60;
    
    // Input tokens: video + audio + prompt
    const videoTokens = minutes * 2500; // Video frames sampling
    const audioTokens = minutes * 1920;  // Audio processing
    const promptOverhead = 3000; // Detailed analysis prompt
    const inputTokens = Math.round(videoTokens + audioTokens + promptOverhead);
    
    // Output tokens: detailed JSON response with all metrics
    // More detailed prompt = more detailed output
    const outputTokens = Math.round(5000 + (minutes * 100)); // Base 5k + ~100 per minute
    
    return { input: inputTokens, output: outputTokens };
};

/**
 * Estimate tokens for transcript-only analysis (Quick mode)
 * Based on real-world usage:
 * - Average speaking rate: ~150 words/minute
 * - Average tokens per word: ~1.3
 * - Prompt overhead: ~3,000 tokens (detailed prompt)
 * - Output tokens: ~4,000-6,000 tokens (detailed JSON response)
 */
export const estimateTranscriptTokens = (durationSeconds: number): { input: number; output: number } => {
    const minutes = durationSeconds / 60;
    
    // Input tokens: transcript text + prompt
    const words = minutes * 150; // Average speaking rate
    const textTokens = words * 1.3; // Average tokens per word
    const promptOverhead = 3000; // Detailed analysis prompt
    const inputTokens = Math.round(textTokens + promptOverhead);
    
    // Output tokens: detailed JSON response
    const outputTokens = Math.round(4000 + (minutes * 50)); // Base 4k + ~50 per minute
    
    return { input: inputTokens, output: outputTokens };
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
            // Quick mode: transcript-only analysis
            const quickTokens = estimateTranscriptTokens(durationSeconds);
            estimatedTokens = quickTokens.input + quickTokens.output;
            estimatedCostUSD = calculateCost('gemini-3-flash-preview', quickTokens.input, quickTokens.output, false);
            estimatedTime = '5-10 секунди';
            features = [
                'Анализ само на текст/транскрипция',
                'Извличане на твърдения и факти',
                'Логически анализ',
                'Най-ниска цена за бърза проверка'
            ];
            break;

        case 'batch':
            // Batch mode: full video analysis with batch pricing (50% discount)
            const batchTokens = estimateVideoTokens(durationSeconds);
            estimatedTokens = batchTokens.input + batchTokens.output;
            estimatedCostUSD = calculateCost('gemini-3-flash-preview', batchTokens.input, batchTokens.output, true);
            estimatedTime = '2-5 минути';
            features = [
                'Пълен анализ на видео + аудио',
                'Визуален анализ (body language, графики)',
                'Тонален анализ (емоции, интонация)',
                '50% по-евтино от Standard режим'
            ];
            break;

        case 'standard':
            // Standard mode: full video analysis
            const standardTokens = estimateVideoTokens(durationSeconds);
            estimatedTokens = standardTokens.input + standardTokens.output;
            estimatedCostUSD = calculateCost('gemini-3-flash-preview', standardTokens.input, standardTokens.output, false);
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
