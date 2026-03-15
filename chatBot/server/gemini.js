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

const APP_KNOWLEDGE = `
FACTCHECKER AI — ЕДИНСТВЕН ИЗТОЧНИК НА ИСТИНАТА. Използвай САМО тази информация. НИКОГА не измисляй, не предполагай, не добавяй детайли.

=== ПЛАТФОРМАТА ===
FactChecker AI е платформа за фактчекинг на видеа и статии. Потребителите получават структурирани анализи с индекси на достоверност и манипулация.

=== УСЛУГИ ===
1. ВИДЕО АНАЛИЗ (YouTube): Два режима:
   - Стандартен: структуриран одит на твърдения, източници и манипулации. Идеален за бърза проверка.
   - Дълбок (Deep): пълен мултимодален одит — визуален, вокален, език на тялото, психологически профил, разширен доклад.
   Цената за видео е ДИНАМИЧНА — зависи от дължината и сложността. Показва се преди анализ.

2. ЛИНК/СТАТИЯ АНАЛИЗ: Анализ на статии по URL. ФИКСИРАНА ЦЕНА: 10 точки.

3. COMPARE MODE: Сравняване на два вече направени анализа (напр. две статии по една тема). ДОПЪЛНИТЕЛНИ 4 точки върху цената на двата основни анализа. Т.е. плащаш двата анализа + 4 точки за сравнението.

4. АРХИВ: Анализите могат да се запазват в архив. Има слотове за видео и линк анализи.

=== ТОЧКИ И ПАКЕТИ ===
- Начален бонус: 100 точки при регистрация.
- Курс: 1 EUR = 100 точки.
- Пакети (еднократна покупка, НЕ абонаменти):
  - Starter: 5 EUR → 500 точки
  - Standard: 15 EUR → 1500 + 200 бонус = 1700 общо (най-популярен)
  - Professional: 44 EUR → 4500 + 1000 бонус = 5500 общо
  - Enterprise: 99 EUR → 10000 + 2500 бонус = 12500 общо
- НЯМА: месечни лимити, зануляване, абонаменти. Точките не изтичат.

=== ВАЖНО ===
- НЕ предлагаме: batch заявки, групови отстъпки, пакети за множество линкове наведнъж.
- За точни цени и актуализации винаги препоръчай /pricing.
- Ако не знаеш нещо — кажи че не си сигурен и препоръчай /pricing или свързване с поддръжка.
`;

export async function getAIResponse(message, history, lang = 'en') {
  const langInstruction = lang === 'bg'
    ? 'Always respond in Bulgarian. The user writes in Bulgarian and expects answers in Bulgarian.'
    : 'Always respond in English.';
  const systemInstruction = `You are the official support assistant for FactChecker AI — a fact-checking platform for videos and articles.

RULES (NEVER BREAK):
1. Use ONLY the knowledge base below. Do NOT invent, assume, or add details.
2. Do NOT mention code, implementation, APIs, or internal technical details.
3. If asked about something not in the knowledge base, say you're not sure and recommend /pricing or connecting with human support.
4. Be professional, concise, and helpful. ${langInstruction}

KNOWLEDGE BASE (your only source of truth):
${APP_KNOWLEDGE}`;

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
    let text = '';
    if (typeof response?.text === 'string') text = response.text;
    else if (typeof response?.text === 'function') { try { text = response.text(); } catch (_) {} }
    else if (response?.text != null && typeof response.text.then === 'function') { try { text = await response.text; } catch (_) { } }
    if (!text && response?.candidates?.[0]?.content?.parts?.length) {
      text = response.candidates[0].content.parts.map(p => p?.text ?? '').join('');
    }
    return (typeof text === 'string' && text.trim() ? text : null) || fallback;
  } catch (error) {
    console.error('[ChatBot Gemini] API error:', error?.message || error);
    const fallback = lang === 'bg'
      ? 'В момента не мога да обработа заявката. Моля, опитайте отново по-късно или се свържете с поддръжката.'
      : 'I am currently unable to process your request. Please try again later or contact support.';
    return fallback;
  }
}
