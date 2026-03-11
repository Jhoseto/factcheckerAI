/**
 * Unified pricing — Client side
 * Mirrors server/config/pricing.js (March 2026, official Google prices)
 * 
 * Architecture:
 *   Stage 1 — Gemini 2.5 Flash: Video+Audio input (cheap)
 *   Stage 2 — Gemini 3.1 Pro Preview: Text-only synthesis (expensive per token, low volume)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Official Gemini API pricing (March 2026, ai.google.dev/pricing)
// ─────────────────────────────────────────────────────────────────────────────
export const GEMINI_PRICING = {
  'gemini-2.5-flash': {
    contextThreshold: 128000,
    // ≤ 128k context
    inputPerMillion: 0.15,          // text + image + video
    audioInputPerMillion: 0.70,     // audio
    outputPerMillion: 0.60,         // non-thinking output
    // > 128k context
    inputPerMillionHigh: 0.30,
    audioInputPerMillionHigh: 1.00,
    outputPerMillionHigh: 2.50,
  },
  'gemini-3.1-pro-preview': {
    contextThreshold: 200000,
    // ≤ 200k context
    inputPerMillion: 2.00,
    outputPerMillion: 12.00,
    // > 200k context
    inputPerMillionHigh: 4.00,
    outputPerMillionHigh: 18.00,
  },
} as const;

// Video token rates (official documentation)
export const VIDEO_TOKENS_PER_SECOND = 263;
export const AUDIO_TOKENS_PER_SECOND = 32;

// Conversion
export const USD_TO_EUR_RATE = 0.95;
export const POINTS_PER_EUR = 100;

// Profit multipliers (must match server/config/pricing.js)
export const PROFIT_MULTIPLIERS = {
  standard: 1.5,
  deep: 2.5,
};

// Minimum points (floor)
export const MIN_POINTS = {
  standard: 3,
  deep: 8,
};

/**
 * Calculate USD cost for a single model call
 */
export const calculateModelCostUSD = (
  model: string,
  promptTokens: number,
  outputTokens: number,
  hasVideo: boolean = false
): number => {
  const pricing = GEMINI_PRICING[model as keyof typeof GEMINI_PRICING]
    ?? GEMINI_PRICING['gemini-2.5-flash'];
  const threshold = pricing.contextThreshold || 128000;
  const isHigh = promptTokens > threshold;

  // Flash with video → split video/audio tokens proportionally
  if (hasVideo && 'audioInputPerMillion' in pricing) {
    const audioRatio = AUDIO_TOKENS_PER_SECOND / (VIDEO_TOKENS_PER_SECOND + AUDIO_TOKENS_PER_SECOND);
    const audioTokens = Math.floor(promptTokens * audioRatio);
    const videoTextTokens = promptTokens - audioTokens;

    const videoRate = isHigh ? pricing.inputPerMillionHigh : pricing.inputPerMillion;
    const audioRate = isHigh ? pricing.audioInputPerMillionHigh : pricing.audioInputPerMillion;
    const outputRate = isHigh ? pricing.outputPerMillionHigh : pricing.outputPerMillion;

    return (videoTextTokens / 1_000_000) * videoRate +
      (audioTokens / 1_000_000) * audioRate +
      (outputTokens / 1_000_000) * outputRate;
  }

  const inputRate = isHigh
    ? (('inputPerMillionHigh' in pricing) ? pricing.inputPerMillionHigh : pricing.inputPerMillion * 2)
    : pricing.inputPerMillion;
  const outputRate = isHigh
    ? (('outputPerMillionHigh' in pricing) ? pricing.outputPerMillionHigh : pricing.outputPerMillion * 2)
    : pricing.outputPerMillion;

  return (promptTokens / 1_000_000) * inputRate +
    (outputTokens / 1_000_000) * outputRate;
};

/**
 * Calculate cost in points (matches server-side calculateVideoCostInPoints)
 */
export const calculateCostInPoints = (
  model: string,
  promptTokens: number,
  candidatesTokens: number,
  _isBatch: boolean = false,
  isDeep: boolean = false
): number => {
  const costUSD = calculateModelCostUSD(model, promptTokens, candidatesTokens);
  const costEUR = costUSD * USD_TO_EUR_RATE;
  const costPoints = costEUR * POINTS_PER_EUR;

  const multiplier = isDeep ? PROFIT_MULTIPLIERS.deep : PROFIT_MULTIPLIERS.standard;
  const finalPoints = Math.ceil(costPoints * multiplier);
  const minPoints = isDeep ? MIN_POINTS.deep : MIN_POINTS.standard;
  return Math.max(minPoints, finalPoints);
};

// Legacy alias
export const calculateCost = calculateModelCostUSD;
