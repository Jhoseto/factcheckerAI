/**
 * Unified pricing configuration for Gemini API models
 * Prices are per 1 million tokens
 * 
 * Gemini 3 Flash pricing (as of 2026):
 * - Standard: $0.50 input, $3.00 output
 * - Batch: 50% discount
 * - Audio input: $1.00 per 1M tokens
 * 
 * Gemini 3 Flash is the RECOMMENDED model:
 * - Pro-grade reasoning at Flash speed
 * - 3x faster than 2.5 Pro
 * - Outperforms 2.5 Pro on benchmarks
 * - 4x cheaper than 3 Pro
 * 
 * Actual pricing may vary - check Google AI Studio for current rates.
 */

export const GEMINI_PRICING = {
  // Using Gemini 1.5 Flash pricing constants (approximate)
  // Input: $0.075 per 1M
  // Output: $0.30 per 1M
  'gemini-3-flash-preview': {
    input: 0.075,
    output: 0.30,
    audio: 0.10, // Approx
  },
  'gemini-3-flash-preview-batch': {
    input: 0.0375, // 50% discount
    output: 0.15,
    audio: 0.05,
  },
  // Keep 3 Pro for critical analyses (optional)
  'gemini-3-pro-preview': {
    input: 2.00,
    output: 12.00,
  },
  'gemini-3-pro-preview-batch': {
    input: 1.00,
    output: 6.00,
  }
} as const;

/**
 * Calculate cost based on token usage
 * @param model - The model name
 * @param promptTokens - Number of input tokens
 * @param candidatesTokens - Number of output tokens
 * @param isBatch - Whether using batch pricing
 * @returns Cost in USD
 */
export const calculateCost = (
  model: string = 'gemini-3-flash-preview',
  promptTokens: number,
  candidatesTokens: number,
  isBatch: boolean = false
): number => {
  const modelKey = isBatch
    ? `${model}-batch`
    : model;

  const pricing = GEMINI_PRICING[modelKey as keyof typeof GEMINI_PRICING]
    || GEMINI_PRICING['gemini-3-flash-preview'];

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (candidatesTokens / 1_000_000) * pricing.output;

  return Math.max(0, inputCost + outputCost); // Ensure non-negative
};

/**
 * Calculate cost in points for user-facing display
 * Applies 2x markup on Gemini API cost
 * @param model - The model name
 * @param promptTokens - Number of input tokens
 * @param candidatesTokens - Number of output tokens
 * @param isBatch - Whether using batch pricing
 * @returns Cost in points (2x markup applied)
 */
export const calculateCostInPoints = (
  model: string = 'gemini-3-flash-preview',
  promptTokens: number,
  candidatesTokens: number,
  isBatch: boolean = false
): number => {
  const costUSD = calculateCost(model, promptTokens, candidatesTokens, isBatch);

  // Convert USD to EUR (approximate 1 USD = 0.93 EUR)
  const costEUR = costUSD * 0.93;

  // Convert to points: €1 = 100 points, with 2x markup
  const points = Math.ceil(costEUR * 100 * 2);

  return points;
};

