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
  'gemini-3.1-pro': {
    inputPerMillion: 1.25,
    outputPerMillion: 5.00,
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
 * Изчислява цената в точки за видео анализ (динамично).
 * Поддържа хибридно изчисляване, ако е масив от { model, promptTokens, candidatesTokens }
 */
function calculateVideoCostInPoints(usageData, isDeep = false, isBatch = false) {
  const dataArray = Array.isArray(usageData) ? usageData : [usageData];
  const batchMultiplier = isBatch ? BATCH_DISCOUNT : 1.0;
  let totalCostUSD = 0;

  for (const item of dataArray) {
    const model = item.model || DEFAULT_MODEL;
    const pTokens = item.promptTokens || 0;
    const cTokens = item.candidatesTokens || 0;

    const pricing = GEMINI_API_PRICING[model] ?? GEMINI_API_PRICING[DEFAULT_MODEL];

    totalCostUSD += (pTokens / 1_000_000) * pricing.inputPerMillion * batchMultiplier;
    totalCostUSD += (cTokens / 1_000_000) * pricing.outputPerMillion * batchMultiplier;
  }

  const totalCostEUR = totalCostUSD * USD_TO_EUR_RATE;
  const basePoints = totalCostEUR * POINTS_PER_EUR;

  const profitMultiplier = isDeep ? PROFIT_MULTIPLIERS.deep : PROFIT_MULTIPLIERS.standard;
  const finalPoints = Math.ceil(basePoints * profitMultiplier);

  const minPoints = isDeep ? MIN_POINTS.videoDeep : MIN_POINTS.videoStandard;
  return Math.max(minPoints, finalPoints);
}

/**
 * Оценя прогнозните точки за видео анализ преди старта.
 * Сега е много по-точен, вземайки предвид хибридния модел (Flash + Pro).
 */
function estimateVideoCostInPoints(durationSeconds, isDeep = false) {
  // Stage 1 (Gemini 2.5 Flash): Video Extraction
  // Видеото генерира средно 250 токена/сек (Input)
  const flashInputTokens = Math.floor(durationSeconds * 250) + 3000;
  const flashOutputTokens = isDeep ? 15000 : 5000; // Flash извлича сурови данни

  const flashPricing = GEMINI_API_PRICING['gemini-2.5-flash'];
  const flashCostUSD = ((flashInputTokens / 1_000_000) * flashPricing.inputPerMillion) +
    ((flashOutputTokens / 1_000_000) * flashPricing.outputPerMillion);

  // Stage 2 (Gemini 3.1 Pro): Smart Grounding & Synthesis
  // Вход: Резултат от Stage 1 (flashOutputTokens) + Промпт (~5k) + Търсене (~5k)
  const proInputTokens = flashOutputTokens + 10000;
  const proOutputTokens = isDeep ? 45000 : 8000; // Финален доклад

  const proPricing = GEMINI_API_PRICING['gemini-3.1-pro'];
  const proCostUSD = ((proInputTokens / 1_000_000) * proPricing.inputPerMillion) +
    ((proOutputTokens / 1_000_000) * proPricing.outputPerMillion);

  const totalCostUSD = flashCostUSD + proCostUSD;
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
