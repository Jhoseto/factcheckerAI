/**
 * FactChecker AI — Централна конфигурация на цените
 * =====================================================
 * ЕДИНСТВЕНОТО МЯСТО за промяна на цените.
 * Всички модули (server + client) трябва да импортират от тук.
 *
 * Последна актуализация: 2026-02
 */

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI API РАЗХОДИ (цени на Google — не се променят от нас)
// ─────────────────────────────────────────────────────────────────────────────
export const GEMINI_API_PRICING = {
  'gemini-2.5-flash': {
    inputPerMillion: 0.50,   // USD за 1M input токена
    outputPerMillion: 2.00,  // USD за 1M output токена
    audioPerMillion: 1.00,   // USD за 1M аудио токена
  },
  'gemini-2.5-pro': {
    inputPerMillion: 1.25,
    outputPerMillion: 5.00,
    audioPerMillion: 2.00,
  },
} as const;

// Модел по подразбиране
export const DEFAULT_MODEL = 'gemini-2.5-flash';

// ─────────────────────────────────────────────────────────────────────────────
// ВАЛУТЕН КУРС
// ─────────────────────────────────────────────────────────────────────────────
export const USD_TO_EUR_RATE = 0.95; // 1 USD = 0.95 EUR

// ─────────────────────────────────────────────────────────────────────────────
// ТОЧКИ КОНВЕРСИЯ
// ─────────────────────────────────────────────────────────────────────────────
export const POINTS_PER_EUR = 100; // 1 EUR = 100 точки

// ─────────────────────────────────────────────────────────────────────────────
// МНОЖИТЕЛИ ЗА ПЕЧАЛБА (profit margin)
// ─────────────────────────────────────────────────────────────────────────────
export const PROFIT_MULTIPLIERS = {
  standard: 2.0,  // x2 — Стандартен видео анализ
  deep: 3.0,      // x3 — Задълбочен видео анализ (x2 * x1.5)
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// МИНИМАЛНИ ЦЕНИ (floor) за динамично таксуване
// ─────────────────────────────────────────────────────────────────────────────
export const MIN_POINTS = {
  videoStandard: 5,   // Минимум за стандартен видео анализ
  videoDeep: 10,      // Минимум за задълбочен видео анализ
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ФИКСИРАНИ ЦЕНИ (в точки)
// Тези услуги имат фиксирана цена независимо от дължината на съдържанието
// ─────────────────────────────────────────────────────────────────────────────
export const FIXED_PRICES = {
  // ── Линк / Статия ──────────────────────────────────────────────────────────
  linkArticle: 12,          // Анализ на уеб статия / новина

  // ── Социални мрежи — Пост ──────────────────────────────────────────────────
  socialPost: 12,            // Анализ на пост (FB / Twitter / TikTok)

  // ── Социални мрежи — Коментари ─────────────────────────────────────────────
  commentAnalysis: 15,      // Анализ на коментари (до 50 коментара)

  // ── Социални мрежи — Пълен одит (пост + коментари) ────────────────────────
  socialFullAudit: 20,      // Пост + коментари заедно

  // ── Сравнителен анализ ─────────────────────────────────────────────────────
  compareMode: 5,           // Допълнителна такса за Compare Mode (върху цената на двата анализа)
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// BATCH DISCOUNT
// ─────────────────────────────────────────────────────────────────────────────
export const BATCH_DISCOUNT = 0.5; // 50% отстъпка при batch заявки

// ─────────────────────────────────────────────────────────────────────────────
// WELCOME BONUS
// ─────────────────────────────────────────────────────────────────────────────
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
    variantId: '1302428', // Lemon Squeezy variant ID
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
    variantId: '1302435',
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
    variantId: '1302443',
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
    variantId: '1302446',
    features: [
      'Достъп до всички функции на платформата',
      'Видео и линк анализ, архив, експорт',
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ПОМОЩНИ ФУНКЦИИ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Изчислява цената в точки за динамично таксуване (видео анализ)
 * @param promptTokens - Брой input токени
 * @param candidatesTokens - Брой output токени
 * @param isDeep - Дали е задълбочен анализ
 * @param isBatch - Дали е batch заявка
 * @param model - Gemini модел
 */
export function calculateVideoCostInPoints(
  promptTokens: number,
  candidatesTokens: number,
  isDeep: boolean = false,
  isBatch: boolean = false,
  model: string = DEFAULT_MODEL
): number {
  const pricing = GEMINI_API_PRICING[model as keyof typeof GEMINI_API_PRICING]
    ?? GEMINI_API_PRICING[DEFAULT_MODEL];

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
export function getFixedPrice(
  serviceType: keyof typeof FIXED_PRICES
): number {
  return FIXED_PRICES[serviceType];
}

/**
 * Проверява дали потребителят може да си позволи дадена услуга
 */
export function canAfford(balance: number, cost: number): boolean {
  return balance >= cost;
}

/**
 * Форматира цена за показване
 */
export function formatPoints(points: number): string {
  return points.toLocaleString('bg-BG') + ' точки';
}
