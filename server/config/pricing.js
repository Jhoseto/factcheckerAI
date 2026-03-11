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
  'gemini-3.1-pro-preview': {
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
  standard: 1.5,  // x1.5 за по-добра стратегия
  deep: 2.5,      // x2.5 (по искане на потребителя: ~90 точки за голям анализ)
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
// ПОМОЩНИ ФУНКЦИИ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Изчислява цената в точки за видео анализ (динамично).
 * Поддържа хибридно изчисляване, ако е масив от { model, promptTokens, candidatesTokens }
 */
function calculateVideoCostInPoints(usageData, isDeep = false) {
  const dataArray = Array.isArray(usageData) ? usageData : [usageData];
  let totalCostUSD = 0;

  for (const item of dataArray) {
    const model = item.model || DEFAULT_MODEL;
    const pTokens = item.promptTokens || 0;
    const cTokens = item.candidatesTokens || 0;

    const pricing = GEMINI_API_PRICING[model] ?? GEMINI_API_PRICING[DEFAULT_MODEL];

    // Gemini Pricing Tier: Contexts > 128k tokens are charged 2x (for 1.5/2.5 Pro/Flash models)
    const isOver128k = pTokens > 128000;
    const inputRate = isOver128k ? pricing.inputPerMillion * 2 : pricing.inputPerMillion;
    const outputRate = isOver128k ? pricing.outputPerMillion * 2 : pricing.outputPerMillion;

    totalCostUSD += (pTokens / 1_000_000) * inputRate;
    totalCostUSD += (cTokens / 1_000_000) * outputRate;
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
  const flashTier = flashInputTokens > 128000 ? 2 : 1;
  const flashCostUSD = ((flashInputTokens / 1_000_000) * flashPricing.inputPerMillion * flashTier) +
    ((flashOutputTokens / 1_000_000) * flashPricing.outputPerMillion * flashTier);

  // Stage 2 (Gemini 3.1 Pro): Smart Grounding & Synthesis
  // Вход: Резултат от Stage 1 (flashOutputTokens) + Промпт (~5k) + Търсене (~5k)
  const proInputTokens = flashOutputTokens + 10000;
  const proOutputTokens = isDeep ? 45000 : 8000; // Финален доклад

  const proPricing = GEMINI_API_PRICING['gemini-3.1-pro-preview'];
  const proTier = proInputTokens > 128000 ? 2 : 1;
  const proCostUSD = ((proInputTokens / 1_000_000) * proPricing.inputPerMillion * proTier) +
    ((proOutputTokens / 1_000_000) * proPricing.outputPerMillion * proTier);

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
  calculateVideoCostInPoints,
  estimateVideoCostInPoints,
  getFixedPrice,
  logBilling,
};
