/**
 * FactChecker AI — Server-side Pricing Configuration
 * ====================================================
 * Единственото място за pricing логика на сървъра.
 * Клиентът получава цените от сървъра след анализ.
 */

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI API РАЗХОДИ (официални цени на Google)
// ─────────────────────────────────────────────────────────────────────────────
const GEMINI_API_PRICING = {
  'gemini-2.5-flash': {
    inputPerMillion: 0.50,
    outputPerMillion: 2.00,
    audioPerMillion: 1.00,
  },
  'gemini-2.5-pro': {
    inputPerMillion: 1.25,
    outputPerMillion: 5.00,
    audioPerMillion: 2.00,
  },
};

const DEFAULT_MODEL = 'gemini-2.5-flash';

// ─────────────────────────────────────────────────────────────────────────────
// ВАЛУТЕН КУРС И КОНВЕРСИЯ
// ─────────────────────────────────────────────────────────────────────────────
const USD_TO_EUR_RATE = 0.95;
const POINTS_PER_EUR = 100;

// ─────────────────────────────────────────────────────────────────────────────
// МНОЖИТЕЛИ ЗА ПЕЧАЛБА
// ─────────────────────────────────────────────────────────────────────────────
const PROFIT_MULTIPLIERS = {
  standard: 2.0,  // x2 — Стандартен видео анализ
  deep: 3.0,      // x3 — Задълбочен видео анализ
};

// ─────────────────────────────────────────────────────────────────────────────
// МИНИМАЛНИ ЦЕНИ (floor)
// ─────────────────────────────────────────────────────────────────────────────
const MIN_POINTS = {
  videoStandard: 5,
  videoDeep: 10,
};

// ─────────────────────────────────────────────────────────────────────────────
// ФИКСИРАНИ ЦЕНИ (в точки)
// ─────────────────────────────────────────────────────────────────────────────
const FIXED_PRICES = {
  linkArticle: 12,        // Анализ на уеб статия / новина
  socialPost: 12,         // Анализ на пост (FB / Twitter / TikTok)
  comment: 5,    // Анализ на коментари (до 50 коментара)
  socialFullAudit: 20,    // Пост + коментари заедно
  compareMode: 5,         // Допълнителна такса за Compare Mode
};

// ─────────────────────────────────────────────────────────────────────────────
// BATCH DISCOUNT
// ─────────────────────────────────────────────────────────────────────────────
const BATCH_DISCOUNT = 0.5;

// ─────────────────────────────────────────────────────────────────────────────
// ПОМОЩНИ ФУНКЦИИ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Изчислява цената в точки за видео анализ (динамично)
 */
function calculateVideoCostInPoints(promptTokens, candidatesTokens, isDeep = false, isBatch = false, model = DEFAULT_MODEL) {
  const pricing = GEMINI_API_PRICING[model] ?? GEMINI_API_PRICING[DEFAULT_MODEL];
  const batchMultiplier = isBatch ? BATCH_DISCOUNT : 1.0;

  const inputCostUSD = (promptTokens / 1_000_000) * pricing.inputPerMillion * batchMultiplier;
  const outputCostUSD = (candidatesTokens / 1_000_000) * pricing.outputPerMillion * batchMultiplier;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  const totalCostEUR = totalCostUSD * USD_TO_EUR_RATE;
  const basePoints = totalCostEUR * POINTS_PER_EUR;

  const profitMultiplier = isDeep ? PROFIT_MULTIPLIERS.deep : PROFIT_MULTIPLIERS.standard;
  const finalPoints = Math.ceil(basePoints * profitMultiplier);

  const minPoints = isDeep ? MIN_POINTS.videoDeep : MIN_POINTS.videoStandard;
  return Math.max(minPoints, finalPoints);
}

/**
 * Връща фиксираната цена за даден тип услуга
 */
function getFixedPrice(serviceType) {
  const price = FIXED_PRICES[serviceType];
  if (price === undefined) {
    throw new Error(`Unknown service type: ${serviceType}`);
  }
  return price;
}

/**
 * Логва billing информация
 */
function logBilling(label, promptTokens, candidatesTokens, costUSD, costEUR, points, isDeep) {
  console.log(`[Billing] ${label}: Input=${promptTokens} tokens ($${costUSD.toFixed(4)}) | EUR=${costEUR.toFixed(4)} | Points=${points} | isDeep=${isDeep}`);
}

export {
  GEMINI_API_PRICING,
  DEFAULT_MODEL,
  USD_TO_EUR_RATE,
  POINTS_PER_EUR,
  PROFIT_MULTIPLIERS,
  MIN_POINTS,
  FIXED_PRICES,
  BATCH_DISCOUNT,
  calculateVideoCostInPoints,
  getFixedPrice,
  logBilling,
};
