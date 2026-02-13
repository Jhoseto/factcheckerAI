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
  // Official Gemini 3 Flash Pricing (Feb 2026)
  // Source: Google Cloud / Vertex AI Pricing
  'gemini-3-flash-preview': {
    input: 0.50,  // $0.50 per 1M tokens (Video/Image/Text)
    output: 3.00, // $3.00 per 1M tokens
    audio: 1.00,  // $1.00 per 1M tokens (Audio specific)
  },
  'gemini-3-flash-preview-batch': {
    input: 0.25,  // 50% discount
    output: 1.50,
    audio: 0.50,
  },
  // Gemini 3 Pro (Reference)
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

  // Note: Audio tokens are usually counted as part of promptTokens in the API response,
  // but if separated, they would need applying pricing.audio.
  // Currently we assume promptTokens includes mixed modalities at base input rate, 
  // or weighted average. For strict accuracy, audio-heavy inputs might cost more ($1.00),
  // but $0.50 is the safe base for video (which is mostly image frames).

  return Math.max(0, inputCost + outputCost);
};

/**
 * Calculate cost in points for user-facing display
 * Strictly applies 2x markup on Gemini API cost (100% Profit Margin)
 * 
 * Formula:
 * 1. Calculate USD Cost to Google
 * 2. Convert to EUR (0.93 rate)
 * 3. Convert to Points (1 EUR = 100 Points)
 * 4. Multiply by 2 (User Price = 2 * Our Cost)
 * 5. Apply Minimum Floor (10 points)
 */
export const calculateCostInPoints = (
  model: string = 'gemini-3-flash-preview',
  promptTokens: number,
  candidatesTokens: number,
  isBatch: boolean = false
): number => {
  const costUSD = calculateCost(model, promptTokens, candidatesTokens, isBatch);

  // Exchange rate: 1 USD = ~0.93 EUR
  const costEUR = costUSD * 0.93;

  // Cost in Points (100 points = 1 EUR)
  const costPoints = costEUR * 100;

  // User Price = 2 * Cost (Double Profit)
  const userPoints = Math.ceil(costPoints * 2);

  // Minimum floor of 10 points (0.10 EUR) to cover fixed overheads for small requests
  return Math.max(10, userPoints);
};

