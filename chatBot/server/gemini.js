/**
 * ChatBot Gemini AI — uses GEMINI_API_KEY from process.env (root .env)
 */
import { GoogleGenAI } from '@google/genai';

let aiInstance = null;

function getAIInstance() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    aiInstance = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiInstance;
}

const PRICING_KNOWLEDGE = `
FACTCHECKER AI — ТОЧНА ИНФОРМАЦИЯ ЗА ТОЧКИТЕ И ЦЕНИТЕ (не измисляй, използвай САМО това):

1. НАЧАЛЕН БОНУС: При регистрация потребителят получава 100 точки безплатно.

2. ПАКЕТИ (не абонаменти!): Това са пакети за еднократна покупка. Няма месечни лимити — точките не се зануляват и могат да се ползват когато потребителят поиска.
   - Starter: 5 EUR → 500 точки
   - Standard: 15 EUR → 1500 точки + 200 бонус = 1700 точки общо (най-популярен)
   - Professional: 44 EUR → 4500 точки + 1000 бонус = 5500 точки общо
   - Enterprise: 99 EUR → 10000 точки + 2500 бонус = 12500 точки общо
   Във всеки пакет има различен брой бонус точки в зависимост от големината на пакета (по-големият пакет = повече бонус).

3. КУРС: 1 EUR = 100 точки

4. ЦЕНИ НА УСЛУГИТЕ (в точки):
   - Анализ на линк/статия: 12 точки фиксирано
   - Видео анализ: цената се изчислява динамично според дължината и сложността на видеото (не е фиксирана)
   - Compare Mode: допълнителна такса върху цената на двата анализа
   - Batch заявки: отстъпка при групови заявки

5. НЯМА: месечни лимити, зануляване на точки, абонаментни планове. Това са пакети за еднократна покупка.

6. За актуални цени и детайли винаги препоръчай страницата /pricing на сайта.
`;

export async function getAIResponse(message, history, lang = 'en') {
  const langInstruction = lang === 'bg'
    ? 'Always respond in Bulgarian. The user writes in Bulgarian and expects answers in Bulgarian.'
    : 'Always respond in English.';
  const systemInstruction = `You are a helpful assistant for FactChecker AI, a fact-checking platform for videos and articles. Help users with questions about how the service works, pricing, analysis types, and technical support. Be professional, concise, and friendly. If you don't know something, offer to connect the user to a human agent. ${langInstruction}

CRITICAL: When answering about points, pricing, or packages, use ONLY this exact information. Do NOT invent monthly limits, point resets, subscriptions, or custom plans:
${PRICING_KNOWLEDGE}`;

  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction
      }
    });
    const fallback = lang === 'bg'
      ? 'В момента не мога да обработа заявката. Моля, опитайте отново по-късно или се свържете с поддръжката.'
      : 'I am currently unable to process your request. Please try again later or contact support.';
    return response.text || fallback;
  } catch (error) {
    const fallback = lang === 'bg'
      ? 'В момента не мога да обработа заявката. Моля, опитайте отново по-късно или се свържете с поддръжката.'
      : 'I am currently unable to process your request. Please try again later or contact support.';
    return fallback;
  }
}
