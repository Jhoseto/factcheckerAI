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
    inputPerMillion: 0.30,
    outputPerMillion: 1.00,
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
  standard: 2.0,  // x2.0 за по-добра стратегия
  deep: 3.0,      // x3.0 (по искане на потребителя: ~90 точки за голям анализ)
};

// ─────────────────────────────────────────────────────────────────────────────
// МИНИМАЛНИ ЦЕНИ (floor)
// ─────────────────────────────────────────────────────────────────────────────
const MIN_POINTS = {
  videoStandard: 3, // Намалено от 5
  videoDeep: 8,     // Намалено от 10
};

// ─────────────────────────────────────────────────────────────────────────────
// ФИКСИРАНИ ЦЕНИ (в точки)
// ─────────────────────────────────────────────────────────────────────────────
const FIXED_PRICES = {
  linkArticle: 10,        // Намалено от 12
  compareMode: 4,         // Намалено от 5
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

  // Gemini context tier pricing logic — Removed doubling penalty for consistency with AI Studio
  const inputRate = pricing.inputPerMillion;
  const outputRate = pricing.outputPerMillion;

  const inputCostUSD = (promptTokens / 1_000_000) * inputRate * batchMultiplier;
  const outputCostUSD = (candidatesTokens / 1_000_000) * outputRate * batchMultiplier;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  const totalCostEUR = totalCostUSD * USD_TO_EUR_RATE;
  const basePoints = totalCostEUR * POINTS_PER_EUR;

  const profitMultiplier = isDeep ? PROFIT_MULTIPLIERS.deep : PROFIT_MULTIPLIERS.standard;
  const finalPoints = Math.ceil(basePoints * profitMultiplier);

  const minPoints = isDeep ? MIN_POINTS.videoDeep : MIN_POINTS.videoStandard;
  return Math.max(minPoints, finalPoints);
}

/**
 * Оценята прогнозните точки за видео анализ преди старта
 */
function estimateVideoCostInPoints(durationSeconds, isDeep = false, model = DEFAULT_MODEL) {
  // Вече доказано: Видеото генерира средно 250 токена/сек (Input)
  const videoTokens = Math.floor(durationSeconds * 250);
  const promptOverhead = isDeep ? 8000 : 3000;
  const inputTokens = videoTokens + promptOverhead;

  // Изходящи (Output): 
  // Стандартен: ~5K. Дълбок: ~45K (с всички допълнителни мултимодални полета)
  const outputTokens = isDeep ? 45000 : 5000;

  const pricing = GEMINI_API_PRICING[model] ?? GEMINI_API_PRICING[DEFAULT_MODEL];

  // Gemini context tier pricing logic — Removed doubling penalty for consistency with AI Studio
  const inputRate = pricing.inputPerMillion;
  const outputRate = pricing.outputPerMillion;

  const inputCostUSD = (inputTokens / 1_000_000) * inputRate;
  const outputCostUSD = (outputTokens / 1_000_000) * outputRate;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  const totalCostEUR = totalCostUSD * USD_TO_EUR_RATE;
  const profitMultiplier = isDeep ? PROFIT_MULTIPLIERS.deep : PROFIT_MULTIPLIERS.standard;
  const finalPoints = Math.ceil(totalCostEUR * POINTS_PER_EUR * profitMultiplier);

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
function logBilling() {
  // Billing logging disabled; use console.error in catch blocks for errors only.
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
  estimateVideoCostInPoints,
  getFixedPrice,
  logBilling,
};
