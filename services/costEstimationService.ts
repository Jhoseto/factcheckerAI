
import { CostEstimate, AnalysisMode } from '../types';
import { GEMINI_PRICING, calculateCost, calculateCostInPoints } from './pricing';

/**
 * Estimate tokens for video analysis based on duration
 * Based on Gemini 3 Flash specifications and real-world usage (Feb 2026):
 * - Video processing: ~111 tokens/second (Real-world observation: 1h ~= 400k tokens)
 * - Audio processing: Included in multimodal token count
 * - 1 Hour Video = ~400,000 tokens
 */
export const estimateVideoTokens = (durationSeconds: number): { input: number; output: number } => {
    const minutes = durationSeconds / 60;

    // Input tokens: Real-world usage indicates ~111 tokens/sec
    const videoTokens = durationSeconds * 111;

    // Prompt overhead: detailed system instructions + user prompt
    const promptOverhead = 2000;

    // Total Input
    const inputTokens = Math.round(videoTokens + promptOverhead);

    // Output tokens: detailed JSON response with all metrics
    // Complex analyses produce ~4k-8k tokens depending on length
    const outputTokens = Math.round(4000 + (minutes * 150));

    return { input: inputTokens, output: outputTokens };
};

/**
 * Estimate tokens for transcript-only analysis (Quick mode)
 * Based on real-world usage:
 * - Average speaking rate: ~150 words/minute
 * - Average tokens per word: ~1.5 (Bulgarian + JSON structure overhead)
 */
export const estimateTranscriptTokens = (durationSeconds: number): { input: number; output: number } => {
    const minutes = durationSeconds / 60;

    // Input tokens: transcript text + prompt
    const words = minutes * 150; // Average speaking rate
    const textTokens = words * 1.5; // Cyrllic/Bulgarian tokens are slightly more expensive
    const promptOverhead = 2000;
    const inputTokens = Math.round(textTokens + promptOverhead);

    // Output tokens: detailed JSON response
    const outputTokens = Math.round(3000 + (minutes * 100));

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
    let pointsCost: number;
    let estimatedTime: string;
    let features: string[];

    switch (mode) {
        case 'quick':
            // Quick mode: transcript-only analysis
            const quickTokens = estimateTranscriptTokens(durationSeconds);
            estimatedTokens = quickTokens.input + quickTokens.output;
            estimatedCostUSD = calculateCost('gemini-3-flash-preview', quickTokens.input, quickTokens.output, false);
            pointsCost = calculateCostInPoints('gemini-3-flash-preview', quickTokens.input, quickTokens.output, false);
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
            pointsCost = calculateCostInPoints('gemini-3-flash-preview', batchTokens.input, batchTokens.output, true);
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
            pointsCost = calculateCostInPoints('gemini-3-flash-preview', standardTokens.input, standardTokens.output, false);
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
        pointsCost: Math.max(0, pointsCost), // Ensure non-negative
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

