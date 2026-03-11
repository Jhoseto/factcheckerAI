/**
 * FactChecker AI — Server-side Pricing Configuration
 * ====================================================
 * Единственото място за pricing логика на сървъра.
 * Клиентът получава цените от сървъра след анализ.
 * 
 * Цени взети от: https://ai.google.dev/pricing (Март 2026)
 * Видео токени: 263 tok/sec (видео кадри) + 32 tok/sec (аудио) = ~295 tok/sec
 */

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI API РАЗХОДИ (официални цени на Google, Март 2026)
// Всяка ценова таблица има: base (≤ праг) и high (> праг)
// ─────────────────────────────────────────────────────────────────────────────
const GEMINI_API_PRICING = {
  'gemini-2.5-flash': {
    contextThreshold: 128000,              // Прагът е 128k токена
    // ≤ 128k контекст
    inputPerMillion: 0.15,                 // $0.15/M за текст+изображения+видео
    audioInputPerMillion: 0.70,            // $0.70/M за аудио
    outputPerMillion: 0.60,                // $0.60/M за non-thinking output
    thinkingOutputPerMillion: 1.25,        // $1.25/M за thinking output
    // > 128k контекст
    inputPerMillionHigh: 0.30,             // $0.30/M за текст+изображения+видео
    audioInputPerMillionHigh: 1.00,        // $1.00/M за аудио
    outputPerMillionHigh: 2.50,            // $2.50/M за non-thinking output
    thinkingOutputPerMillionHigh: 2.50,    // $2.50/M за thinking output
  },
  'gemini-3.1-pro-preview': {
    contextThreshold: 200000,              // Прагът е 200k токена
    // ≤ 200k контекст
    inputPerMillion: 2.00,                 // $2.00/M за текст+изображения+видео
    outputPerMillion: 12.00,               // $12.00/M output (thinking included)
    // > 200k контекст
    inputPerMillionHigh: 4.00,             // $4.00/M
    outputPerMillionHigh: 18.00,           // $18.00/M
  },
  'gemini-2.5-pro': {
    contextThreshold: 200000,
    inputPerMillion: 1.25,
    audioInputPerMillion: 2.00,
    outputPerMillion: 10.00,
    inputPerMillionHigh: 2.50,
    audioInputPerMillionHigh: 4.00,
    outputPerMillionHigh: 15.00,
  },
};

const DEFAULT_MODEL = 'gemini-2.5-flash';

// ─────────────────────────────────────────────────────────────────────────────
// ВИДЕО ТОКЕНИЗАЦИЯ (официална документация на Google)
// ─────────────────────────────────────────────────────────────────────────────
const VIDEO_TOKENS_PER_SECOND = 263;  // Видео кадри → токени
const AUDIO_TOKENS_PER_SECOND = 32;   // Аудио → токени

// ─────────────────────────────────────────────────────────────────────────────
// ВАЛУТЕН КУРС И КОНВЕРСИЯ
// ─────────────────────────────────────────────────────────────────────────────
const USD_TO_EUR_RATE = 0.95;
const POINTS_PER_EUR = 100;

// ─────────────────────────────────────────────────────────────────────────────
// МНОЖИТЕЛИ ЗА ПЕЧАЛБА
// ─────────────────────────────────────────────────────────────────────────────
const PROFIT_MULTIPLIERS = {
  standard: 1.8,  // Увеличен от 1.5, за да се намали голямата разлика с Deep
  deep: 2.5
};

// ─────────────────────────────────────────────────────────────────────────────
// МИНИМАЛНИ ЦЕНИ (floor)
// ─────────────────────────────────────────────────────────────────────────────
const MIN_POINTS = {
  videoStandard: 3,
  videoDeep: 8,
  linkArticle: 10
};

// ─────────────────────────────────────────────────────────────────────────────
// ФИКСИРАНИ ЦЕНИ (в точки)
// ─────────────────────────────────────────────────────────────────────────────
const FIXED_PRICES = {
  linkArticle: 10,
  compareMode: 4,
};

// ─────────────────────────────────────────────────────────────────────────────
// ПОМОЩНИ ФУНКЦИИ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Изчислява РЕАЛНАТА цена в USD за даден модел и токени,
 * с отчитане на tier-а (base или high).
 * 
 * hasVideo: true → за Flash модела, promptTokens включват видео (263 tok/sec) 
 *  и аудио (32 tok/sec). Разделяме ги пропорционално за точна цена.
 */
function calculateModelCostUSD(model, promptTokens, outputTokens, hasVideo = false) {
  const pricing = GEMINI_API_PRICING[model] ?? GEMINI_API_PRICING[DEFAULT_MODEL];
  const threshold = pricing.contextThreshold || 128000;
  const isHigh = promptTokens > threshold;

  // Ако моделът има отделна цена за аудио И е видео вход → разделяме токените
  if (hasVideo && pricing.audioInputPerMillion) {
    // Пропорция: 263 видео : 32 аудио = 89.15% : 10.85%
    const audioRatio = AUDIO_TOKENS_PER_SECOND / (VIDEO_TOKENS_PER_SECOND + AUDIO_TOKENS_PER_SECOND);
    // Текстовият промпт е малка част (~3000 токена), третиран като видео вход
    const audioTokens = Math.floor(promptTokens * audioRatio);
    const videoTextTokens = promptTokens - audioTokens;

    const videoRate = isHigh ? (pricing.inputPerMillionHigh || pricing.inputPerMillion * 2) : pricing.inputPerMillion;
    const audioRate = isHigh ? (pricing.audioInputPerMillionHigh || pricing.audioInputPerMillion * 2) : pricing.audioInputPerMillion;
    const outputRate = isHigh ? (pricing.outputPerMillionHigh || pricing.outputPerMillion * 2) : pricing.outputPerMillion;

    return (videoTextTokens / 1_000_000) * videoRate +
      (audioTokens / 1_000_000) * audioRate +
      (outputTokens / 1_000_000) * outputRate;
  }

  // Стандартно изчисление (текстов вход или модел без отделна аудио цена)
  const inputRate = isHigh
    ? (pricing.inputPerMillionHigh || pricing.inputPerMillion * 2)
    : pricing.inputPerMillion;
  const outputRate = isHigh
    ? (pricing.outputPerMillionHigh || pricing.outputPerMillion * 2)
    : pricing.outputPerMillion;

  const inputCost = (promptTokens / 1_000_000) * inputRate;
  const outputCost = (outputTokens / 1_000_000) * outputRate;

  return inputCost + outputCost;
}

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
    totalCostUSD += calculateModelCostUSD(model, pTokens, cTokens, item.hasVideo || false);
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
 * Използва официалното тегло: 263 tok/sec (видео) + 32 tok/sec (аудио) = 295 tok/sec
 */
function estimateVideoCostInPoints(durationSeconds, isDeep = false) {
  // Stage 1 (Gemini 2.5 Flash): Video + Audio Extraction
  const videoTokens = Math.floor(durationSeconds * VIDEO_TOKENS_PER_SECOND);
  const audioTokens = Math.floor(durationSeconds * AUDIO_TOKENS_PER_SECOND);
  const textPromptTokens = 3000;  // Константи за реалистична оценка
  const flashInputTokens = videoTokens + audioTokens + textPromptTokens;
  const stage1Output = isDeep ? 15000 : 7000;

  // Flash tier
  const flashPricing = GEMINI_API_PRICING['gemini-2.5-flash'];
  const flashIsHigh = flashInputTokens > flashPricing.contextThreshold;

  // Video + text tokens use inputPerMillion, audio uses audioInputPerMillion
  const videoInputRate = flashIsHigh ? flashPricing.inputPerMillionHigh : flashPricing.inputPerMillion;
  const audioInputRate = flashIsHigh ? flashPricing.audioInputPerMillionHigh : flashPricing.audioInputPerMillion;
  const flashOutputRate = flashIsHigh ? flashPricing.outputPerMillionHigh : flashPricing.outputPerMillion;

  const flashCostUSD =
    ((videoTokens + textPromptTokens) / 1_000_000) * videoInputRate +
    (audioTokens / 1_000_000) * audioInputRate +
    (stage1Output / 1_000_000) * flashOutputRate;

  // Stage 2 (Gemini 3.1 Pro Preview): Smart Grounding & Synthesis (TEXT ONLY)
  const proInputTokens = stage1Output + 10000; // Резултат от Stage 1 + промпт
  const proOutputTokens = isDeep ? 50000 : 12000;

  const proCostUSD = calculateModelCostUSD('gemini-3.1-pro-preview', proInputTokens, proOutputTokens);

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
  VIDEO_TOKENS_PER_SECOND,
  AUDIO_TOKENS_PER_SECOND,
  calculateModelCostUSD,
  calculateVideoCostInPoints,
  estimateVideoCostInPoints,
  getFixedPrice,
  logBilling,
};
