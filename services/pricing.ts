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
  // Gemini 2.5 Flash / 1.5 Flash (Standard High-Speed Model)
  // Updated to "High Tier" pricing per user request ($0.50 Input / $2.00 Output)
  'gemini-2.5-flash': {
    input: 0.50,
    output: 2.00,
    audio: 1.00,
  },
  // Gemini 3 Pro (Legacy/Pro Tier)
  'gemini-3-pro-preview': {
    input: 1.25, // Pro is more expensive
    output: 5.00,
    audio: 2.50,
  },
  'gemini-3-pro-preview-batch': {
    input: 0.625,
    output: 2.50,
    audio: 1.25,
  }
} as const;

// ... existing calculateCost ...

export const calculateCostInPoints = (
  model: string = 'gemini-2.5-flash',
  promptTokens: number,
  candidatesTokens: number,
  isBatch: boolean = false
): number => {
  const costUSD = calculateCost(model, promptTokens, candidatesTokens, isBatch);

  // Exchange rate: 1 USD = ~0.95 EUR (Simplified to 1:1 for buffer or 0.95)
  // Let's use 1 USD = 0.95 EUR
  const costEUR = costUSD * 0.95;

  // Cost in Points (100 points = 1 EUR)
  const costPoints = costEUR * 100;

  // User Price = 2 * Cost (Double Cost = 50% Margin for us? No, 100% Markup)
  // "Points must be double what the model takes from me"
  const userPoints = Math.ceil(costPoints * 2);

  // Minimum floor of 5 points to allow cheap requests but cover defaults
  return Math.max(5, userPoints);
};

