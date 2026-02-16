
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
    // Estimate tokens with MEDIA_RESOLUTION_LOW:
    // ~66 tokens/frame (1 FPS) + ~32 tokens/sec audio = ~100 tokens/sec
    const inputTokens = Math.floor(durationSeconds * 100) + 2000; // + prompt overhead

    // Output: ~4000 tokens base + 150 per minute
    const minutes = durationSeconds / 60;
    const outputTokens = Math.floor(4000 + (minutes * 150));
    const estimatedTokens = inputTokens + outputTokens;

    // Both modes now use Gemini 2.5 Flash for cost estimation
    const modelId = 'gemini-2.5-flash';

    // Calculate Costs (pass isDeep so Deep mode gets x3 multiplier)
    const isDeep = mode === 'deep';
    const totalCostUSD = calculateCost(modelId, inputTokens, outputTokens, false);
    const pointsCost = calculateCostInPoints(modelId, inputTokens, outputTokens, false, isDeep);

    return {
        mode,
        estimatedTokens,
        estimatedInputTokens: inputTokens,
        inputCostUSD: 0, // Simplified for now
        outputCostUSD: 0,
        totalCostObserved: totalCostUSD,
        pointsCost,
        margin: (pointsCost / 100 * 2) - totalCostUSD // Rough margin calculation
    };
};

/**
 * Get all cost estimates for a video
 */
export const getAllCostEstimates = (durationSeconds: number): Record<AnalysisMode, CostEstimate> => {
    return {
        standard: calculateCostEstimate('standard', durationSeconds),
        deep: calculateCostEstimate('deep', durationSeconds)
    };
};

