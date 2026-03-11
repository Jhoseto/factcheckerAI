/**
 * FactChecker AI — Централна конфигурация на цените
 * =====================================================
 * ЕДИНСТВЕНОТО МЯСТО за промяна на цените.
 * Всички модули (server + client) трябва да импортират от тук.
 *
 * Последна актуализация: 2026-03 (Март 2026, Google Official)
 */

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI API РАЗХОДИ (цени на Google — ai.google.dev/pricing)
// ─────────────────────────────────────────────────────────────────────────────
export const GEMINI_API_PRICING = {
  'gemini-2.5-flash': {
    contextThreshold: 128000,
    inputPerMillion: 0.15,          // $0.15/M (вместо $0.50)
    outputPerMillion: 0.60,         // $0.60/M (вместо $2.00)
    audioPerMillion: 0.70,          // $0.70/M (вместо $1.00)
    // High Tier (>128k)
    inputPerMillionHigh: 0.30,
    outputPerMillionHigh: 2.50,
    audioPerMillionHigh: 1.00,
  },
  'gemini-3.1-pro-preview': {
    contextThreshold: 200000,
    inputPerMillion: 2.00,
    outputPerMillion: 12.00,
    inputPerMillionHigh: 4.00,
    outputPerMillionHigh: 18.00,
  },
} as const;

// Модел по подразбиране
export const DEFAULT_MODEL = 'gemini-2.5-flash';

// ─────────────────────────────────────────────────────────────────────────────
// ВАЛУТЕН КУРС
// ─────────────────────────────────────────────────────────────────────────────
export const USD_TO_EUR_RATE = 0.95;

// ─────────────────────────────────────────────────────────────────────────────
// ТОЧКИ КОНВЕРСИЯ
// ─────────────────────────────────────────────────────────────────────────────
export const POINTS_PER_EUR = 100;

// ─────────────────────────────────────────────────────────────────────────────
// МНОЖИТЕЛИ ЗА ПЕЧАЛБА (Profit Margin - Синхронизирани със сървъра)
// ─────────────────────────────────────────────────────────────────────────────
export const PROFIT_MULTIPLIERS = {
  standard: 1.5,  // x1.5 за стандартен видео анализ
  deep: 2.5,      // x2.5 за задълбочен видео анализ
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// МИНИМАЛНИ ЦЕНИ (floor) за динамично таксуване
// ─────────────────────────────────────────────────────────────────────────────
export const MIN_POINTS = {
  videoStandard: 3,
  videoDeep: 8,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ФИКСИРАНИ ЦЕНИ (в точки)
// ─────────────────────────────────────────────────────────────────────────────
export const FIXED_PRICES = {
  linkArticle: 10,
  compareMode: 4,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ДОПЪЛНИТЕЛНИ ПАРАМЕТРИ
// ─────────────────────────────────────────────────────────────────────────────
export const BATCH_DISCOUNT = 0.5; // 50% отстъпка (не се поддържа от моделите, но е запазено за съвместимост)
export const WELCOME_BONUS_POINTS = 100; // Точки при регистрация

// ─────────────────────────────────────────────────────────────────────────────
// PRICING TIERS (за Pricing страницата)
// ─────────────────────────────────────────────────────────────────────────────
export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    priceEur: 5,
    basePoints: 500,
    bonusPoints: 0,
    totalPoints: 500,
    popular: false,
    variantId: '1362624',
    features: [
      'Достъп до всички функции на платформата',
      'Видео и линк анализ, архив, експорт',
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    priceEur: 15,
    basePoints: 1500,
    bonusPoints: 200,
    totalPoints: 1700,
    popular: true,
    variantId: '1362623',
    features: [
      'Достъп до всички функции на платформата',
      'Видео и линк анализ, архив, експорт',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    priceEur: 44,
    basePoints: 4500,
    bonusPoints: 1000,
    totalPoints: 5500,
    popular: false,
    variantId: '1362620',
    features: [
      'Достъп до всички функции на платформата',
      'Видео и линк анализ, архив, експорт',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceEur: 99,
    basePoints: 10000,
    bonusPoints: 2500,
    totalPoints: 12500,
    popular: false,
    variantId: '1362618',
    features: [
      'Достъп до всички функции на платформата',
      'Видео и линк анализ, архив, експорт',
    ],
  },
] as const;

/**
 * Изчислява цената в точки (Клиентска версия)
 * Трябва да съответства на логиката в services/pricing.ts и server/config/pricing.js
 */
export function calculateVideoCostInPoints(
  promptTokens: number,
  candidatesTokens: number,
  isDeep: boolean = false,
  _isBatch: boolean = false, // Не се поддържа вече
  model: string = DEFAULT_MODEL
): number {
  const pricing = (GEMINI_API_PRICING as any)[model] ?? GEMINI_API_PRICING[DEFAULT_MODEL];
  const threshold = pricing.contextThreshold || 128000;
  const isHigh = promptTokens > threshold;

  const inputRate = isHigh ? (pricing.inputPerMillionHigh || pricing.inputPerMillion * 2) : pricing.inputPerMillion;
  const outputRate = isHigh ? (pricing.outputPerMillionHigh || pricing.outputPerMillion * 2) : pricing.outputPerMillion;

  const totalCostUSD = (promptTokens / 1_000_000) * inputRate + (candidatesTokens / 1_000_000) * outputRate;
  const totalCostEUR = totalCostUSD * USD_TO_EUR_RATE;
  const basePoints = totalCostEUR * POINTS_PER_EUR;

  const profitMultiplier = isDeep ? PROFIT_MULTIPLIERS.deep : PROFIT_MULTIPLIERS.standard;
  const finalPoints = Math.ceil(basePoints * profitMultiplier);

  const minPoints = isDeep ? MIN_POINTS.videoDeep : MIN_POINTS.videoStandard;
  return Math.max(minPoints, finalPoints);
}
