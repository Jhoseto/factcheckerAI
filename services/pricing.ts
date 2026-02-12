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
  'gemini-3-flash-preview': {
    input: 0.50,   // $0.50 per 1M input tokens (text/image/video)
    output: 3.00,  // $3.00 per 1M output tokens
    audio: 1.00,   // $1.00 per 1M audio input tokens
  },
  'gemini-3-flash-preview-batch': {
    input: 0.25,   // $0.25 per 1M input tokens (50% discount for batch)
    output: 1.50, // $1.50 per 1M output tokens (50% discount for batch)
    audio: 0.50,  // $0.50 per 1M audio input tokens (50% discount for batch)
  },
  // Keep 3 Pro for critical analyses (optional)
  'gemini-3-pro-preview': {
    input: 2.00,   // $2.00 per 1M input tokens
    output: 12.00, // $12.00 per 1M output tokens
  },
  'gemini-3-pro-preview-batch': {
    input: 1.00,   // $1.00 per 1M input tokens (50% discount for batch)
    output: 6.00,  // $6.00 per 1M output tokens (50% discount for batch)
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

