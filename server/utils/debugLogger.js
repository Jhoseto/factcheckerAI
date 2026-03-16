/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  DEBUG AI LOGGER  —  server/utils/debugLogger.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  Пише ПОДРОБЕН лог в:  server/logs/ai_debug.log
 *
 *  Включен/изключен чрез .env:
 *    DEBUG_AI_LOG=true    ← включено (по подразбиране false)
 *
 *  За да МАХНЕШ логването напълно от кода — просто изтрий/преименувай
 *  този файл. Всички извиквания в gemini.js хващат грешки тихо.
 *
 *  Какво логва:
 *   • Началото на всяка заявка  (тип, модел, serviceType, режим)
 *   • Пълния system prompt (system instruction)
 *   • Пълния user prompt
 *   • Всички Google Search заявки, които моделът изпраща
 *   • Резултатите от Google Search (URLs + snippets)
 *   • Thinking/reasoning текст на модела (ако е наличен)
 *   • Raw отговора на модела (първите 3000 символа)
 *   • Usage токени и изчислена цена
 *   • Грешки и retry опити
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'ai_debug.log');

// ── Включено само ако DEBUG_AI_LOG=true в .env ────────────────────────────────
const ENABLED = process.env.DEBUG_AI_LOG === 'true';

// Ротация: максимален размер на лог файла (10 MB) → архивира старото
const MAX_LOG_BYTES = 10 * 1024 * 1024;

// ── Инициализация на директорията ────────────────────────────────────────────
if (ENABLED) {
    try {
        if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
        // Ротация при нужда
        if (fs.existsSync(LOG_FILE)) {
            const stat = fs.statSync(LOG_FILE);
            if (stat.size > MAX_LOG_BYTES) {
                const archived = LOG_FILE.replace('.log', `_${Date.now()}.log`);
                fs.renameSync(LOG_FILE, archived);
                console.log(`[DebugLogger] Ротация — архивиран: ${archived}`);
            }
        }
        console.log(`[DebugLogger] ✅ AI Debug логването е ВКЛЮЧЕНО → ${LOG_FILE}`);
    } catch (e) {
        console.error('[DebugLogger] ⚠️ Неуспешна инициализация:', e.message);
    }
}

// ── Вътрешна функция за писане ────────────────────────────────────────────────
function write(text) {
    if (!ENABLED) return;
    try {
        fs.appendFileSync(LOG_FILE, text, 'utf8');
    } catch (e) {
        // Тихо — не блокира основния поток
    }
}

function ts() {
    return new Date().toISOString();
}

function separator(char = '═', len = 80) {
    return char.repeat(len);
}

function truncate(str, maxLen = 3000) {
    if (!str) return '(празно)';
    const s = String(str);
    if (s.length <= maxLen) return s;
    return s.substring(0, maxLen) + `\n... [СЪКРАТЕНО: ${s.length - maxLen} символа останали] ...`;
}

// ═════════════════════════════════════════════════════════════════════════════
//  ПУБЛИЧНО API
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Логва началото на AI заявка.
 * @param {object} opts
 * @param {string} opts.requestId     Уникален ID за тази заявка
 * @param {string} opts.route         '/generate' | '/generate-stream' | '/synthesize-report'
 * @param {string} opts.stage         'stage1_extraction' | 'stage2_synthesis' | 'single' | etc.
 * @param {string} opts.model         ID на модела
 * @param {string} opts.serviceType   'video' | 'linkArticle' | 'text'
 * @param {string} opts.mode          'deep' | 'standard'
 * @param {string} opts.userId        User ID (за идентификация)
 * @param {boolean} opts.hasGoogleSearch  Дали e включен Google Search tool
 */
export function logRequest(opts) {
    if (!ENABLED) return;
    const { requestId, route, stage, model, serviceType, mode, userId, hasGoogleSearch } = opts;
    write(`
${separator()}
🚀 НОВА AI ЗАЯВКА  [${ts()}]
${separator()}
  ID:            ${requestId}
  Рут:           ${route}
  Етап:          ${stage}
  Модел:         ${model}
  Тип услуга:    ${serviceType || '(не е зададен)'}
  Режим:         ${mode || 'standard'}
  Потребител:    ${userId || 'анонимен'}
  Google Search: ${hasGoogleSearch ? '✅ ВКЛЮЧЕН' : '❌ изключен'}
  Час:           ${ts()}
`);
}

/**
 * Логва system instruction (системния промпт).
 * @param {string} requestId
 * @param {string} systemInstruction
 */
export function logSystemPrompt(requestId, systemInstruction) {
    if (!ENABLED) return;
    write(`
${separator('-')}
📋 SYSTEM INSTRUCTION  [ID: ${requestId}]
${separator('-')}
${truncate(systemInstruction, 5000)}
${separator('-')}
`);
}

/**
 * Логва потребителския промпт (текстовата част).
 * @param {string} requestId
 * @param {string} userPrompt
 * @param {boolean} hasVideo  Дали заявката съдържа видео
 */
export function logUserPrompt(requestId, userPrompt, hasVideo = false) {
    if (!ENABLED) return;
    write(`
${separator('-')}
💬 USER PROMPT  [ID: ${requestId}]${hasVideo ? '  🎬 + ВИДЕО' : ''}
${separator('-')}
${truncate(userPrompt, 8000)}
${separator('-')}
`);
}

/**
 * Логва Google Search заявките, направени от модела.
 * Извиква се когато анализираме response.candidates[*].content.parts
 * и намерим grounding/search metadata или functionCall с google_search.
 *
 * @param {string} requestId
 * @param {Array} searchQueries   Масив от стрингове — заявките
 * @param {Array} groundingChunks Масив от обекти с .web.uri и .web.title
 */
export function logGoogleSearches(requestId, searchQueries, groundingChunks) {
    if (!ENABLED) return;
    let text = `
${separator('─')}
🔍 GOOGLE SEARCH  [ID: ${requestId}]  [${ts()}]
${separator('─')}
`;

    if (searchQueries && searchQueries.length > 0) {
        text += `\n🔎 ЗАЯВКИ (${searchQueries.length}):\n`;
        searchQueries.forEach((q, i) => {
            text += `  ${i + 1}. "${q}"\n`;
        });
    } else {
        text += `\n  (Няма засечени заявки или са скрити от API-то)\n`;
    }

    if (groundingChunks && groundingChunks.length > 0) {
        text += `\n📌 РЕЗУЛТАТИ / ИЗТОЧНИЦИ (${groundingChunks.length}):\n`;
        groundingChunks.slice(0, 20).forEach((chunk, i) => {
            const uri = chunk?.web?.uri || chunk?.uri || '(без URL)';
            const title = chunk?.web?.title || chunk?.title || '(без заглавие)';
            text += `  ${i + 1}. [${title}]\n       ${uri}\n`;
        });
        if (groundingChunks.length > 20) {
            text += `  ... и още ${groundingChunks.length - 20} резултата\n`;
        }
    }

    text += `${separator('─')}\n`;
    write(text);
}

/**
 * Логва thinking/reasoning текста на модела (ако е наличен в response).
 * @param {string} requestId
 * @param {string} thinkingText
 */
export function logThinking(requestId, thinkingText) {
    if (!ENABLED) return;
    if (!thinkingText || thinkingText.trim().length < 10) return;
    write(`
${separator('·')}
🧠 МИСЛЕНЕ НА МОДЕЛА  [ID: ${requestId}]  [${ts()}]
${separator('·')}
${truncate(thinkingText, 10000)}
${separator('·')}
`);
}

/**
 * Логва суровия отговор на модела.
 * @param {string} requestId
 * @param {string} stage     'stage1' | 'stage2' | 'final'
 * @param {string} rawText
 * @param {object} usageMeta  usageMetadata обект от Gemini
 */
export function logRawResponse(requestId, stage, rawText, usageMeta) {
    if (!ENABLED) return;
    const tokens = usageMeta ? `Prompt: ${usageMeta.promptTokenCount || 0} | Output: ${usageMeta.candidatesTokenCount || 0} | Total: ${usageMeta.totalTokenCount || 0}` : '(няма данни)';
    write(`
${separator('─')}
📨 СУРОВ ОТГОВОР [${stage}]  [ID: ${requestId}]  [${ts()}]
  Токени: ${tokens}
  Дължина: ${rawText ? rawText.length : 0} символа
${separator('─')}
${truncate(rawText, 3000)}
${separator('─')}
`);
}

/**
 * Логва грешка или retry опит.
 * @param {string} requestId
 * @param {string} message
 * @param {*} error
 */
export function logError(requestId, message, error) {
    if (!ENABLED) return;
    write(`
${separator('!')}
❌ ГРЕШКА  [ID: ${requestId}]  [${ts()}]
  Съобщение: ${message}
  Детайли:   ${error?.message || String(error || '')}
${separator('!')}
`);
}

/**
 * Логва края на заявката с обобщение.
 * @param {string} requestId
 * @param {boolean} success
 * @param {number} finalPoints
 * @param {object} usageSummary
 */
export function logComplete(requestId, success, finalPoints, usageSummary) {
    if (!ENABLED) return;
    const status = success ? '✅ УСПЕХ' : '❌ НЕУСПЕХ';
    write(`
${separator()}
${status}  КРАЙ НА ЗАЯВКА  [ID: ${requestId}]  [${ts()}]
  Точки: ${finalPoints || 0}
  Токени (prompt): ${usageSummary?.promptTokenCount || 0}
  Токени (output): ${usageSummary?.candidatesTokenCount || 0}
${separator()}

`);
}

/**
 * Извлича Google Search metadata от Gemini response обект.
 * Връща { searchQueries: string[], groundingChunks: object[] }
 *
 * @param {object} response  Gemini response обект
 * @returns {{ searchQueries: string[], groundingChunks: object[] }}
 */
export function extractSearchMetadata(response) {
    try {
        const candidate = response?.candidates?.[0];
        const groundingMeta = candidate?.groundingMetadata;

        const searchQueries = groundingMeta?.searchEntryPoint?.renderedContent
            ? [groundingMeta.searchEntryPoint.renderedContent]
            : (groundingMeta?.webSearchQueries || []);

        const groundingChunks = groundingMeta?.groundingChunks || [];

        // Търси и в parts за functionCall (по-стар формат)
        const parts = candidate?.content?.parts || [];
        const fnCalls = parts
            .filter(p => p?.functionCall?.name === 'google_search' || p?.function_call?.name === 'google_search')
            .map(p => {
                const args = p?.functionCall?.args || p?.function_call?.args || {};
                return args.query || args.q || JSON.stringify(args);
            });

        const allQueries = [...new Set([...searchQueries, ...fnCalls])];

        // Извличаме thinking text от parts
        const thinkingParts = parts.filter(p => p?.thought === true || p?.thoughtSignature);
        const thinkingText = thinkingParts.map(p => p.text || '').join('\n\n').trim();

        return { searchQueries: allQueries, groundingChunks, thinkingText };
    } catch (e) {
        return { searchQueries: [], groundingChunks: [], thinkingText: '' };
    }
}

/**
 * Помощна функция — генерира кратък уникален ID за заявката.
 * @returns {string}
 */
export function newRequestId() {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const debugLog = ENABLED;
