
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
 * 
 * Key factors for accurate estimation:
 * - Input: ~100 tokens/sec (MEDIA_RESOLUTION_LOW) + prompt overhead
 * - Output: Highly dependent on mode:
 *   - Standard: maxOutputTokens=20000, typical ~8-12K output + ~3-5K thinking
 *   - Deep: maxOutputTokens=65536, typical ~20-35K output + ~5-10K thinking
 * - Gemini 2.5 Flash uses "thinking" tokens (billed as output) on top of content
 */
export const calculateCostEstimate = (
    mode: AnalysisMode,
    durationSeconds: number
): CostEstimate => {
    const minutes = durationSeconds / 60;

    // Input tokens: video (~250 tokens/sec at LOW res) + prompt
    // Deep prompt is ~8K tokens, standard is ~3K tokens
    const videoTokens = Math.floor(durationSeconds * 250);
    const promptOverhead = mode === 'deep' ? 8000 : 3000;
    const inputTokens = videoTokens + promptOverhead;

    // Output tokens: content + thinking tokens
    // Standard: ~5K total (including thinking)
    // Deep: ~45K total (detailed JSON + 7 multimodal fields + thinking)
    let outputTokens: number;
    if (mode === 'deep') {
        outputTokens = 45000;
    } else {
        outputTokens = 5000;
    }
    outputTokens = Math.min(outputTokens, 65536);

    const estimatedTokens = inputTokens + outputTokens;

    // Both modes use Gemini 2.5 Flash
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

