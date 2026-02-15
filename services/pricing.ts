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
  // Official Gemini 3 Flash Pricing (Set to DOUBLE 2.5 Flash per user request)
  // Standard: $0.50 -> Deep: $1.00
  'gemini-3-flash-preview': {
    input: 1.00,  // DOUBLE of 2.5 Flash
    output: 4.00, // DOUBLE of 2.5 Flash
    audio: 2.00,
  },
  'gemini-3-flash-preview-batch': {
    input: 0.50,
    output: 2.00,
    audio: 1.00,
  },
  // Gemini 2.5 Flash / 1.5 Flash (Standard High-Speed Model)
  // Updated to "High Tier" pricing per user request ($0.50 Input / $2.00 Output)
  'gemini-2.5-flash': {
    input: 0.50,
    output: 2.00,
    audio: 1.00,
  },
  // Gemini 3 Pro (Legacy/Pro Tier) - Also set to Double
  'gemini-3-pro-preview': {
    input: 1.00,
    output: 4.00,
    audio: 2.00,
  },
  'gemini-3-pro-preview-batch': {
    input: 0.50,
    output: 2.00,
    audio: 1.00,
  }
} as const;

/**
 * Calculate cost based on token usage
 */
export const calculateCost = (
  model: string = 'gemini-2.5-flash',
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

  return Math.max(0, inputCost + outputCost);
};

/**
 * Calculate cost in points for user-facing display
 * Strictly applies multiplier on Gemini API cost
 * 
 * Formula:
 * 1. Calculate USD Cost
 * 2. Convert to EUR (0.95 rate)
 * 3. Convert to Points (1 EUR = 100 Points)
 * 4. Multiply by 2 (User Price = 2 * Our Cost) ("Standard")
 * 5. IF DEEP MODE: Multiply by 2 AGAIN (User Price = 4 * Our Cost)
 * 
 * Result: Deep Analysis is ALWAYS double the points of Standard Analysis.
 */
export const calculateCostInPoints = (
  model: string = 'gemini-2.5-flash',
  promptTokens: number,
  candidatesTokens: number,
  isBatch: boolean = false,
  isDeep: boolean = false // New param for explicit doubling
): number => {
  const costUSD = calculateCost(model, promptTokens, candidatesTokens, isBatch);

  // Exchange rate: 1 USD = ~0.95 EUR
  const costEUR = costUSD * 0.95;

  // Cost in Points (100 points = 1 EUR)
  const costPoints = costEUR * 100;

  // User Price = 2 * Cost (Base Multiplier)
  let userPoints = Math.ceil(costPoints * 2);

  // IF Deep Analysis: Double the points
  if (isDeep) {
    userPoints = userPoints * 2;
  }

  // Minimum floor
  // Standard: 5 points. Deep: 10 points.
  const minPoints = isDeep ? 10 : 5;
  return Math.max(minPoints, userPoints);
};
