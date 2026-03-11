
import { CostEstimate, AnalysisMode } from '../types';
import {
    GEMINI_PRICING,
    calculateModelCostUSD,
    VIDEO_TOKENS_PER_SECOND,
    AUDIO_TOKENS_PER_SECOND,
    USD_TO_EUR_RATE,
    POINTS_PER_EUR,
    PROFIT_MULTIPLIERS,
    MIN_POINTS
} from './pricing';

/**
 * Estimate cost for video analysis using the HYBRID 2-STAGE architecture.
 * 
 * Stage 1 (Gemini 2.5 Flash) — Video + Audio input extraction (cheap)
 *   - Video: 263 tok/sec, Audio: 32 tok/sec → total ~295 tok/sec
 *   - Output: raw research data text
 * 
 * Stage 2 (Gemini 3.1 Pro Preview) — Text-only synthesis (expensive per token, low volume)
 *   - Input: Stage 1 output + prompts (text only, no video)
 *   - Output: structured JSON analysis for all tabs
 * 
 * This mirrors server/config/pricing.js → estimateVideoCostInPoints()
 */
export const calculateCostEstimate = (
    mode: AnalysisMode,
    durationSeconds: number
): CostEstimate => {
    const isDeep = mode === 'deep';

    // ── Stage 1: Flash 2.5 (Video + Audio Input) ─────────────────────────
    const videoTokens = Math.floor(durationSeconds * VIDEO_TOKENS_PER_SECOND);
    const audioTokens = Math.floor(durationSeconds * AUDIO_TOKENS_PER_SECOND);
    const textPromptTokens = 3000; // System instruction + schema
    const flashInputTokens = videoTokens + audioTokens + textPromptTokens;
    const flashOutputTokens = isDeep ? 15000 : 5000;

    const flashPricing = GEMINI_PRICING['gemini-2.5-flash'];
    const flashIsHigh = flashInputTokens > flashPricing.contextThreshold;

    const videoInputRate = flashIsHigh ? flashPricing.inputPerMillionHigh : flashPricing.inputPerMillion;
    const audioInputRate = flashIsHigh ? flashPricing.audioInputPerMillionHigh : flashPricing.audioInputPerMillion;
    const flashOutputRate = flashIsHigh ? flashPricing.outputPerMillionHigh : flashPricing.outputPerMillion;

    const flashCostUSD =
        ((videoTokens + textPromptTokens) / 1_000_000) * videoInputRate +
        (audioTokens / 1_000_000) * audioInputRate +
        (flashOutputTokens / 1_000_000) * flashOutputRate;

    // ── Stage 2: Pro 3.1 (Text-only Synthesis) ───────────────────────────
    const proInputTokens = flashOutputTokens + 10000; // Stage 1 output + prompt
    const proOutputTokens = isDeep ? 45000 : 8000;

    const proCostUSD = calculateModelCostUSD(
        'gemini-3.1-pro-preview',
        proInputTokens,
        proOutputTokens,
        false // no video — text only
    );

    // ── Total ────────────────────────────────────────────────────────────
    const totalCostUSD = flashCostUSD + proCostUSD;
    const totalCostEUR = totalCostUSD * USD_TO_EUR_RATE;

    const multiplier = isDeep ? PROFIT_MULTIPLIERS.deep : PROFIT_MULTIPLIERS.standard;
    const pointsCost = Math.max(
        isDeep ? MIN_POINTS.deep : MIN_POINTS.standard,
        Math.ceil(totalCostEUR * POINTS_PER_EUR * multiplier)
    );

    const totalInputTokens = flashInputTokens + proInputTokens;
    const totalOutputTokens = flashOutputTokens + proOutputTokens;

    return {
        mode,
        estimatedTokens: totalInputTokens + totalOutputTokens,
        estimatedInputTokens: totalInputTokens,
        inputCostUSD: flashCostUSD,
        outputCostUSD: proCostUSD,
        totalCostObserved: totalCostUSD,
        pointsCost,
        margin: (pointsCost / POINTS_PER_EUR) - totalCostUSD
    };
};

/**
 * Get cost estimates for both modes
 */
export const getAllCostEstimates = (durationSeconds: number): Record<AnalysisMode, CostEstimate> => {
    return {
        standard: calculateCostEstimate('standard', durationSeconds),
        deep: calculateCostEstimate('deep', durationSeconds)
    };
};

// Legacy exports for backward compatibility
export const estimateVideoTokens = (durationSeconds: number) => {
    const input = Math.floor(durationSeconds * (VIDEO_TOKENS_PER_SECOND + AUDIO_TOKENS_PER_SECOND)) + 3000;
    const output = 8000;
    return { input, output };
};

export const estimateTranscriptTokens = (durationSeconds: number) => {
    const minutes = durationSeconds / 60;
    const input = Math.round(minutes * 150 * 1.5 + 2000);
    const output = Math.round(3000 + minutes * 100);
    return { input, output };
};
