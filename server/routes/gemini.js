/**
 * Gemini API Routes
 * /api/gemini/generate         — Standard generation (non-video)
 * /api/gemini/generate-stream  — SSE streaming for video analysis
 * /api/gemini/synthesize-report — Report synthesis
 *
 * BILLING: Points are deducted SERVER-SIDE after successful generation.
 * Client does NOT deduct points — it only refreshes the displayed balance.
 */

import express from 'express';
import { randomUUID } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { requireAuth } from '../middleware/auth.js';
import { analysisRateLimiter } from '../middleware/rateLimiter.js';
import {
    getUserPoints,
    deductPointsFromUser
} from '../services/firebaseAdmin.js';
import { getMaxAnalysesPerDay, getAnalysesCountToday } from '../services/configService.js';
import {
    calculateVideoCostInPoints,
    calculateModelCostUSD,
    estimateVideoCostInPoints,
    getFixedPrice,
    GEMINI_API_PRICING
} from '../config/pricing.js';
import { MODELS } from '../config/models.js';
import { logActivity } from '../../admin/server/activityLogger.js';
import {
    logRequest, logSystemPrompt, logUserPrompt, logGoogleSearches,
    logThinking, logRawResponse, logError, logComplete,
    extractSearchMetadata, newRequestId
} from '../utils/debugLogger.js';
const router = express.Router();

/** Escape raw control chars inside JSON string literals so JSON.parse accepts the string. */
function escapeControlCharsInJson(text) {
    let out = '';
    let inString = false;
    let escape = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const code = text.charCodeAt(i);
        if (escape) {
            if (code < 0x20) {
                if (code === 0x0a) out += '\\n';
                else if (code === 0x0d) out += '\\r';
                else if (code === 0x09) out += '\\t';
                else out += '\\u' + code.toString(16).padStart(4, '0');
            } else out += ch;
            escape = false;
            continue;
        }
        if (ch === '\\' && inString) {
            escape = true;
            out += ch;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            out += ch;
            continue;
        }
        if (inString && code < 0x20) {
            if (code === 0x0a) out += '\\n';
            else if (code === 0x0d) out += '\\r';
            else if (code === 0x09) out += '\\t';
            else out += '\\u' + code.toString(16).padStart(4, '0');
            continue;
        }
        out += ch;
    }
    return out;
}

/** Parse JSON from Gemini response: strip markdown, then parse (with one fallback for control chars). */
function parseJsonRobust(rawText) {
    if (!rawText || typeof rawText !== 'string') return { ok: false, error: 'empty' };
    let t = rawText.trim();
    const jsonBlock = t.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlock) t = jsonBlock[1].trim();
    else t = t.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim();
    if (!t.length) return { ok: false, error: 'empty' };

    try {
        return { ok: true, parsed: JSON.parse(t) };
    } catch (_) { }
    try {
        return { ok: true, parsed: JSON.parse(escapeControlCharsInJson(t)) };
    } catch (_) { }
    return { ok: false, error: 'parse failed' };
}

/**
 * When Flash fills visualAnalysis/bodyLanguage… arrays but omits multimodalObservations string, rebuild marker text.
 */
function serializeMultimodalFromStage1Arrays(parsed) {
    if (!parsed || typeof parsed !== 'object') return '';
    const map = [
        ['VISUAL', 'visualAnalysis'],
        ['BODY LANGUAGE', 'bodyLanguageAnalysis'],
        ['VOCAL', 'vocalAnalysis'],
        ['DECEPTION', 'deceptionAnalysis'],
        ['HUMOR', 'humorAnalysis']
    ];
    const blocks = [];
    for (const [label, key] of map) {
        const arr = parsed[key];
        if (!Array.isArray(arr)) continue;
        const lines = [];
        let n = 0;
        for (const item of arr) {
            const p = String(item?.point ?? '').trim();
            const d = String(item?.details ?? item?.description ?? '').trim();
            const low = `${p} ${d}`.toLowerCase();
            if (!p && !d) continue;
            if (low.includes('no significant observations')) continue;
            n += 1;
            lines.push(p && d ? `${n}. ${p}: ${d}` : `${n}. ${p || d}`);
        }
        if (lines.length) blocks.push(`[${label}]\n${lines.join('\n')}`);
    }
    return blocks.join('\n\n');
}

/**
 * Turn Stage 1 `multimodalObservations` text (with [VISUAL]…[HUMOR] markers) into
 * VIDEO_DEEP_SCHEMA arrays. Used to OVERRIDE Stage 2 output — Pro does not see video and
 * often hallucinates visual/vocal/body content if left to fill JSON alone.
 */
function textChunkToPointDetails(body, fallbackPoint) {
    const t = (body || '').trim();
    if (!t) {
        return [{ point: fallbackPoint, details: 'No significant observations were noted in the video analysis.' }];
    }
    let chunks = t.split(/\n(?=\d+\.\s)/).map(s => s.trim()).filter(Boolean);
    if (chunks.length <= 1) {
        chunks = t.split(/\n(?=[•\-\*\u2022]\s)/u).map(s => s.trim()).filter(Boolean);
    }
    if (chunks.length <= 1) {
        chunks = t.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
    }
    if (chunks.length <= 1 && !/^\d+\.\s/.test(t)) {
        return [{ point: fallbackPoint, details: t }];
    }
    const out = [];
    for (const chunk of chunks) {
        const stripped = chunk.replace(/^\d+\.\s*/, '').trim();
        const colonIdx = stripped.indexOf(':');
        if (colonIdx > 0 && colonIdx < 120) {
            out.push({
                point: stripped.slice(0, colonIdx).trim(),
                details: stripped.slice(colonIdx + 1).trim()
            });
        } else {
            out.push({ point: fallbackPoint, details: stripped });
        }
    }
    return out.length ? out : [{ point: fallbackPoint, details: t }];
}

/** Non-marker prose length — detects empty skeleton [VISUAL]\\n[BODY]... with no substance */
function bareMultimodalProseLen(mm) {
    if (!mm || typeof mm !== 'string') return 0;
    return mm.replace(/\[[^\]]+\]/g, ' ').replace(/\s+/g, ' ').trim().length;
}

function multimodalArrayKeys() {
    return ['visualAnalysis', 'bodyLanguageAnalysis', 'vocalAnalysis', 'deceptionAnalysis', 'humorAnalysis'];
}

function itemIsMultimodalPlaceholder(it) {
    const p = String(it?.point ?? '').trim().toLowerCase();
    const d = String(it?.details ?? '').trim().toLowerCase();
    const b = `${p} ${d}`;
    if (/no significant observations/.test(b)) return true;
    if (/^no significant observations$/.test(p)) return true;
    if (/няма значими наблюдения/.test(b)) return true;
    if (/няма върнати наблюдения/.test(b)) return true;
    if (/не са отбелязани значими наблюдения/.test(b)) return true;
    if (/в\s+видеоанализа\s+не\s+са\s+отбелязани/i.test(b)) return true;
    if (/не\s+са\s+намерени\s+значими/i.test(b)) return true;
    return false;
}

function isPlaceholderArray(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return true;
    return arr.every(itemIsMultimodalPlaceholder);
}

/**
 * Patch multimodal tabs from Stage 1: only overwrite tabs that are empty or placeholder-only,
 * so a partial [VISUAL] parse does not replace good Stage 2 text with English "no observations" slots.
 */
function mergeMultimodalTabs(stage2, patchObj, onlyFillPlaceholders) {
    if (!stage2 || !patchObj || typeof patchObj !== 'object') {
        return { parsed: stage2, patched: false };
    }
    const merged = { ...stage2 };
    let patched = false;
    for (const k of multimodalArrayKeys()) {
        const patch = patchObj[k];
        if (!Array.isArray(patch) || patch.length === 0) continue;
        if (isPlaceholderArray(patch)) continue;
        const cur = stage2[k];
        const curWeak = isPlaceholderArray(cur);
        if (onlyFillPlaceholders ? curWeak : true) {
            merged[k] = patch;
            patched = true;
        }
    }
    return { parsed: merged, patched };
}

function multimodalTabLabelFallback(lang, field) {
    const en = String(lang || 'bg').toLowerCase().startsWith('en');
    const names = en
        ? { visualAnalysis: 'Visual', bodyLanguageAnalysis: 'Body language', vocalAnalysis: 'Vocal', deceptionAnalysis: 'Deception', humorAnalysis: 'Humor' }
        : { visualAnalysis: 'Визуален', bodyLanguageAnalysis: 'Тяло / език на тялото', vocalAnalysis: 'Вокал', deceptionAnalysis: 'Измама / несъответствие', humorAnalysis: 'Хумор' };
    return `${names[field] || field} (${en ? 'Stage 1' : 'етап 1'})`;
}

function pickMultimodalArraysFromParsed(parsed) {
    if (!parsed || typeof parsed !== 'object') return {};
    const o = {};
    for (const k of multimodalArrayKeys()) {
        if (Array.isArray(parsed[k])) o[k] = parsed[k];
    }
    return o;
}

/** Normalize BG/EN marker variants so extraction does not miss sections → empty UI tabs */
function normalizeMultimodalMarkerText(mm) {
    if (!mm || typeof mm !== 'string') return mm;
    let s = mm.replace(/\r\n/g, '\n');
    // Plain-line section titles (models often omit square brackets; UI labels Визуален / Тяло / …)
    s = s.replace(/^\s*визуален(\s+анализ|\s+слой)?\s*:?\s*$/gim, '\n[VISUAL]\n');
    s = s.replace(/^\s*тяло(\s+и\s+език|\s+език\s+на\s*тялото)?\s*:?\s*$/gim, '\n[BODY LANGUAGE]\n');
    s = s.replace(/^\s*вокал(?:ен)?(?:\s+анализ)?\s*:?\s*$/gim, '\n[VOCAL]\n');
    s = s.replace(/^\s*измама(\s+и\s+несъответствие)?\s*:?\s*$/gim, '\n[DECEPTION]\n');
    s = s.replace(/^\s*хумор(\s+и\s+ирония)?\s*:?\s*$/gim, '\n[HUMOR]\n');
    s = s.replace(/\[(измама|ИЗМАМА|Измама)\]/g, '[DECEPTION]');
    s = s.replace(/\[(хумор|ХУМОР|Хумор)\]/g, '[HUMOR]');
    s = s.replace(/\[(визуален|ВИЗУАЛЕН|визуално|ВИЗУАЛНО)\]/gi, '[VISUAL]');
    s = s.replace(/\[(език\s*на\s*тялото|ЕЗИК\s*НА\s*ТЯЛОТО|език-на-тялото)\]/gi, '[BODY LANGUAGE]');
    s = s.replace(/\[(вокален|ВОКАЛЕН|вокал|ВОКАЛ)\]/gi, '[VOCAL]');
    // lowercase English markers often produced by models
    s = s.replace(/\[(visual)\]/gi, '[VISUAL]');
    s = s.replace(/\[(body\s*language)\]/gi, '[BODY LANGUAGE]');
    s = s.replace(/\[(vocal)\]/gi, '[VOCAL]');
    s = s.replace(/\[(deception)\]/gi, '[DECEPTION]');
    s = s.replace(/\[(humo?r)\]/gi, '[HUMOR]');
    // After normalizing BG/EN tags, break glued headers onto their own lines
    s = s.replace(/\[VISUAL\]\s*:?\s*/gi, '\n[VISUAL]\n');
    s = s.replace(/\[BODY\s+LANGUAGE\]\s*:?\s*/gi, '\n[BODY LANGUAGE]\n');
    s = s.replace(/\[VOCAL\]\s*:?\s*/gi, '\n[VOCAL]\n');
    s = s.replace(/\[DECEPTION\]\s*:?\s*/gi, '\n[DECEPTION]\n');
    s = s.replace(/\[HUMOR\]\s*:?\s*/gi, '\n[HUMOR]\n');
    s = s.replace(/\n{3,}/g, '\n\n').trim();
    return s;
}

/** Model “I can’t see video” / metadata-only disclaimers — reject for multimodal merge */
function isLikelyMultimodalRefusal(text) {
    if (!text || typeof text !== 'string') return false;
    const t = text.toLowerCase();
    const needles = [
        'нямам достъп', 'не мога да гледам', 'не мога да анализирам видео', 'извън моите', 'изцяло на предоставеното заглавие',
        'само заглавие', 'само метаданни', 'моят анализ се базира', 'тези секции биха изисквали', 'директен анализ на видео',
        'cannot watch', 'cannot access the video', 'do not have the video', 'i do not have access to the video',
        'based solely on the title', 'based only on the title', 'without seeing the video', 'without watching',
        'outside my current capabilities', 'beyond my current capabilities', 'cannot perform video analysis'
    ];
    return needles.some(n => t.includes(n));
}

/** Replace tab items that are “I can’t see video” disclaimers with neutral placeholder */
function stripRefusalFromMultimodalFields(obj) {
    if (!obj || typeof obj !== 'object') return;
    const fields = ['visualAnalysis', 'bodyLanguageAnalysis', 'vocalAnalysis', 'deceptionAnalysis', 'humorAnalysis'];
    const neutral = {
        point: 'Наблюдение недостъпно',
        details: 'Текстът беше филтриран (съдържаше отказ за видеоанализ вместо наблюдения от записа). Пускайте анализ отново; ако проблемът се повтаря, опитайте по-кратък клип.'
    };
    for (const f of fields) {
        const arr = obj[f];
        if (!Array.isArray(arr)) continue;
        obj[f] = arr.map((it) => {
            const blob = `${it?.details ?? ''}\n${it?.point ?? ''}`;
            if (isLikelyMultimodalRefusal(blob)) return { ...neutral };
            return it;
        });
    }
}

function parseMultimodalObservationsToSchemaArrays(multimodalText) {
    if (!multimodalText || typeof multimodalText !== 'string') return null;
    const mm = normalizeMultimodalMarkerText(multimodalText).trim();
    if (!mm || mm === 'MISSING_STAGE_1_MULTIMODAL_OBSERVATIONS') return null;

    const sections = [
        ['VISUAL', 'visualAnalysis', 'Visual'],
        ['BODY LANGUAGE', 'bodyLanguageAnalysis', 'Body language'],
        ['VOCAL', 'vocalAnalysis', 'Vocal'],
        ['DECEPTION', 'deceptionAnalysis', 'Deception / congruence'],
        ['HUMOR', 'humorAnalysis', 'Humor']
    ];
    const result = {};
    for (let i = 0; i < sections.length; i++) {
        const [label, field, fb] = sections[i];
        const tag = `[${label}]`;
        const start = mm.indexOf(tag);
        if (start < 0) {
            result[field] = [{ point: fb, details: 'No significant observations were noted in the video analysis.' }];
            continue;
        }
        const after = start + tag.length;
        let end = mm.length;
        for (let j = i + 1; j < sections.length; j++) {
            const nextTag = `[${sections[j][0]}]`;
            const ni = mm.indexOf(nextTag, after);
            if (ni >= 0) end = Math.min(end, ni);
        }
        const body = mm.slice(after, end).trim();
        result[field] = textChunkToPointDetails(body, fb);
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: language instruction for analysis output (do not edit prompt files)
// ─────────────────────────────────────────────────────────────────────────────
function getLanguageInstruction(lang) {
    const normalized = (lang || 'bg').toLowerCase();
    if (normalized === 'en' || normalized.startsWith('en-')) {
        return 'Output language: you must write the entire analysis and all text only in English.';
    }
    return 'Output language: you must write the entire analysis and all text only in Bulgarian.';
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress messages for streaming (BG/EN depending on client lang)
// ─────────────────────────────────────────────────────────────────────────────
const PROGRESS_MSG = {
    bg: {
        start: 'Стартиране на DCGE модела...',
        deepPreparing: 'Изготвяне на (DCGE) задълбочен анализ (може да отнеме до няколко минути)...',
        retry: 'Повторен опит при празен отговор...',
        googleRound: (r) => `Търсене в Google (кръг ${r})...`,
        finalJson: 'Заявка за финален отговор...',
        synthesizing: (kb) => `Синтезиране (${kb} KB)...`,
        googleSearch: (n) => `Търсене в Google (${n} заявки)...`,
        analyzing: (kb) => `Анализиране (${kb} KB)...`,
        finalizing: 'Финализиране...'
    },
    en: {
        start: 'Starting DCGE model...',
        deepPreparing: 'Preparing (DCGE) deep analysis (may take several minutes)...',
        retry: 'Retrying after empty response...',
        googleRound: (r) => `Google search (round ${r})...`,
        finalJson: 'Requesting final JSON response...',
        synthesizing: (kb) => `Synthesizing (${kb} KB)...`,
        googleSearch: (n) => `Google search (${n} requests)...`,
        analyzing: (kb) => `Analyzing (${kb} KB)...`,
        finalizing: 'Finalizing...'
    }
};
function getProgressMsg(lang, key, ...args) {
    const isEn = (lang || 'bg').toLowerCase().startsWith('en');
    const msgs = isEn ? PROGRESS_MSG.en : PROGRESS_MSG.bg;
    const fn = msgs[key];
    return typeof fn === 'function' ? fn(...args) : fn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get Gemini AI instance (module-level singleton)
// ─────────────────────────────────────────────────────────────────────────────
let _aiInstance = null;
function getAI() {
    if (!_aiInstance) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
        if (!apiKey) throw new Error('Server configuration error: Missing server-side API key');
        _aiInstance = new GoogleGenAI({ apiKey });
    }
    return _aiInstance;
}

// Point-details structure for multimodal analysis arrays
const POINT_DETAILS_ITEM = {
    type: 'object',
    properties: { point: { type: 'string' }, details: { type: 'string' } },
    required: ['point', 'details']
};

// JSON Schema for structured output — detailed nested structure for WoW analysis
// NOTE: maxItems is NOT supported by Gemini structured output API — causes INVALID_ARGUMENT 400 errors
const VIDEO_PROPERTIES = {
    summary: {
        type: 'object',
        required: ['overallSummary', 'credibilityIndex', 'manipulationIndex', 'totalDuration', 'detailedStats'],
        properties: {
            overallSummary: { type: 'string' },
            credibilityIndex: { type: 'number' },
            manipulationIndex: { type: 'number' },
            unverifiablePercent: { type: 'number' },
            finalClassification: { type: 'string' },
            recommendations: { type: 'string' },
            totalDuration: { type: 'string' },
            detailedStats: {
                type: 'object',
                properties: {
                    factualAccuracy: { type: 'number' },
                    logicalSoundness: { type: 'number' },
                    emotionalBias: { type: 'number' },
                    propagandaScore: { type: 'number' },
                    sourceReliability: { type: 'number' },
                    subjectivityScore: { type: 'number' },
                    objectivityScore: { type: 'number' },
                    biasIntensity: { type: 'number' }
                }
            }
        }
    },
    claims: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                claim: { type: 'string' },
                quote: { type: 'string' },
                formulation: { type: 'string' },
                category: { type: 'string' },
                verdict: { type: 'string', enum: ['TRUE', 'MOSTLY_TRUE', 'MIXED', 'MOSTLY_FALSE', 'FALSE', 'UNVERIFIABLE'] },
                veracity: { type: 'string' },
                explanation: { type: 'string' },
                missingContext: { type: 'string' },
                confidence: { type: 'number' },
                speaker: { type: 'string' },
                timestamp: { type: 'string' }
            },
            required: ['claim', 'verdict', 'explanation', 'quote']
        }
    },
    quotes: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                quote: { type: 'string' },
                speaker: { type: 'string' },
                timestamp: { type: 'string' },
                context: { type: 'string' },
                importance: { type: 'string', enum: ['high', 'medium', 'low'] },
                analysis: { type: 'string' }
            },
            required: ['quote', 'analysis']
        }
    },
    manipulations: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                technique: { type: 'string' },
                timestamp: { type: 'string' },
                logic: { type: 'string' },
                effect: { type: 'string' },
                severity: { type: 'number' },
                counterArgument: { type: 'string' }
            },
            required: ['technique', 'logic', 'effect']
        }
    },
    finalInvestigativeReport: { type: 'string' },
    geopoliticalContext: { type: 'array', items: POINT_DETAILS_ITEM },
    historicalParallel: { type: 'array', items: POINT_DETAILS_ITEM },
    psychoLinguisticAnalysis: { type: 'array', items: POINT_DETAILS_ITEM },
    strategicIntent: { type: 'array', items: POINT_DETAILS_ITEM },
    narrativeArchitecture: { type: 'array', items: POINT_DETAILS_ITEM },
    technicalForensics: { type: 'array', items: POINT_DETAILS_ITEM },
    socialImpactPrediction: { type: 'array', items: POINT_DETAILS_ITEM },
    visualAnalysis: { type: 'array', items: POINT_DETAILS_ITEM },
    bodyLanguageAnalysis: { type: 'array', items: POINT_DETAILS_ITEM },
    vocalAnalysis: { type: 'array', items: POINT_DETAILS_ITEM },
    deceptionAnalysis: { type: 'array', items: POINT_DETAILS_ITEM },
    humorAnalysis: { type: 'array', items: POINT_DETAILS_ITEM },
    psychologicalProfile: { type: 'array', items: POINT_DETAILS_ITEM },
    culturalSymbolicAnalysis: { type: 'array', items: POINT_DETAILS_ITEM },
    recommendations: { type: 'array', items: POINT_DETAILS_ITEM },
    biasIndicators: { type: 'object' }
};

const VIDEO_STANDARD_SCHEMA = {
    type: 'object',
    required: ['summary', 'claims', 'manipulations', 'finalInvestigativeReport'],
    properties: VIDEO_PROPERTIES
};

const VIDEO_DEEP_SCHEMA = {
    type: 'object',
    required: [
        'summary', 'claims', 'manipulations', 'visualAnalysis', 'bodyLanguageAnalysis',
        'vocalAnalysis', 'deceptionAnalysis', 'humorAnalysis', 'psychologicalProfile', 'culturalSymbolicAnalysis'
    ],
    properties: VIDEO_PROPERTIES
};


const LINK_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        siteName: { type: 'string' },
        summary: { type: 'string' },
        overallAssessment: { type: 'string' },
        detailedMetrics: { type: 'object' },
        authorProfile: { type: 'object' },
        mediaProfile: { type: 'object' },
        headlineAnalysis: {
            type: 'object',
            properties: {
                isClickbait: { type: 'boolean' },
                matchScore: { type: 'number' },
                explanation: { type: 'string' },
                sensationalWords: { type: 'array', items: { type: 'string' } }
            }
        },
        emotionalTriggers: { type: 'array', items: { type: 'object' } },
        sensationalismIndex: { type: 'number' },
        circularCitation: { type: 'string' },
        missingVoices: { type: 'array', items: { type: 'string' } },
        timingAnalysis: { type: 'string' },
        freshnessCheck: { type: 'string' },
        alternativeSources: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    url: { type: 'string' },
                    reason: { type: 'string' }
                }
            }
        },
        recommendations: { type: 'string' },
        finalInvestigativeReport: { type: 'string' },
        geopoliticalContext: { type: 'string' },
        historicalParallel: { type: 'string' },
        psychoLinguisticAnalysis: { type: 'string' },
        strategicIntent: { type: 'string' },
        narrativeArchitecture: { type: 'string' },
        technicalForensics: { type: 'string' },
        socialImpactPrediction: { type: 'string' },
        dataPointsProcessed: { type: 'number' },
        factualClaims: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    claim: { type: 'string' },
                    verdict: { type: 'string' },
                    evidence: { type: 'string' },
                    sources: { type: 'array', items: { type: 'string' } },
                    confidence: { type: 'number' },
                    context: { type: 'string' },
                    logicalAnalysis: { type: 'string' },
                    factualVerification: { type: 'string' },
                    comparison: { type: 'string' }
                }
            }
        },
        manipulationTechniques: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    technique: { type: 'string' },
                    timestamp: { type: 'string' },
                    description: { type: 'string' },
                    impact: { type: 'string' },
                    effect: { type: 'string' },
                    severity: { type: 'number' },
                    counterArgument: { type: 'string' },
                    example: { type: 'string' },
                    speaker: { type: 'string' },
                    logic: { type: 'string' }
                }
            }
        },
        commentsAnalysis: {
            type: 'object',
            properties: {
                found: { type: 'boolean' },
                source: { type: 'string' },
                totalAnalyzed: { type: 'number' },
                sentiment: { type: 'string' },
                overallSummary: { type: 'string' },
                polarizationIndex: { type: 'number' },
                botActivitySuspicion: { type: 'number' },
                dominantThemes: { type: 'array', items: { type: 'string' } },
                keyOpinions: { type: 'array', items: { type: 'string' } },
                manipulationInComments: { type: 'string' }
            }
        }
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: validate and clean JSON response
// Enhanced for Deep mode with Google Search tools
// ─────────────────────────────────────────────────────────────────────────────
function validateJsonResponse(responseText, serviceType = 'link') {
    if (!responseText || responseText.length < 5) {
        return { valid: false, code: 'AI_EMPTY_RESPONSE' };
    }

    const parseResult = parseJsonRobust(responseText);
    if (!parseResult.ok) {
        return { valid: false, code: 'AI_JSON_PARSE_ERROR', error: parseResult.error };
    }
    const parsed = parseResult.parsed;

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { valid: false, code: 'AI_INCOMPLETE_RESPONSE', parsed };
    }

    if (serviceType === 'video') {
        const hasSummary = typeof parsed.summary === 'string';
        const hasAssessment = typeof parsed.overallAssessment === 'string';
        const hasAnyContent =
            hasSummary ||
            hasAssessment ||
            (Array.isArray(parsed.factualClaims) && parsed.factualClaims.length > 0) ||
            (Array.isArray(parsed.claims) && parsed.claims.length > 0) ||
            (Array.isArray(parsed.manipulationTechniques) && parsed.manipulationTechniques.length > 0) ||
            (parsed.finalInvestigativeReport && typeof parsed.finalInvestigativeReport === 'string');
        if (hasAnyContent) {
            return { valid: true, parsed, cleanedText: JSON.stringify(parsed) };
        }
        return { valid: false, code: 'AI_INCOMPLETE_RESPONSE', parsed };
    }

    const hasSomething = parsed.summary || parsed.title || parsed.overallAssessment || parsed.factualClaims;
    if (!hasSomething) return { valid: false, code: 'AI_INCOMPLETE_RESPONSE', parsed };
    return { valid: true, parsed, cleanedText: JSON.stringify(parsed) };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gemini/generate — Standard (non-video) generation
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate', requireAuth, analysisRateLimiter, async (req, res) => {
    // Increase timeout to 15 minutes for deep analysis
    req.setTimeout(15 * 60 * 1000);
    res.setTimeout(15 * 60 * 1000);

    try {
        const ai = getAI();
        const userId = req.userId;
        const { model, prompt, systemInstruction, videoUrl, isBatch, enableGoogleSearch, mode, serviceType, lang, images } = req.body;
        const _dbgId = newRequestId();
        logRequest({ requestId: _dbgId, route: '/generate', stage: 'init', model: model || 'auto', serviceType, mode, userId, hasGoogleSearch: !!(enableGoogleSearch || mode === 'deep') });

        // ── Determine cost type ───────────────────────────────────────────────
        const isFixedPrice = serviceType && serviceType !== 'video';
        const isDeepMode = mode === 'deep';

        // ── Pre-flight balance check ──────────────────────────────────────────
        const currentBalance = await getUserPoints(userId);
        let minRequired;
        if (isFixedPrice) {
            minRequired = getFixedPrice(serviceType);
        } else {
            const duration = req.body.metadata?.videoDuration || req.body.metadata?.duration || 0;
            const estimated = estimateVideoCostInPoints(duration, isDeepMode);
            minRequired = Math.ceil(estimated * 1.2); // 20% safety buffer
        }

        if (currentBalance < minRequired) {
            return res.status(403).json({
                error: 'Insufficient points. Please top up your balance.',
                code: 'INSUFFICIENT_POINTS',
                currentBalance
            });
        }

        // ── Daily analyses limit ───────────────────────────────────────────────
        const maxPerDay = await getMaxAnalysesPerDay();
        if (maxPerDay) {
            const countToday = await getAnalysesCountToday(userId);
            if (countToday >= maxPerDay) {
                return res.status(403).json({
                    error: `Достигнахте дневния лимит от ${maxPerDay} анализа. Опитайте утре.`,
                    code: 'DAILY_LIMIT_REACHED',
                    countToday,
                    maxPerDay
                });
            }
        }

        // ── Build request ─────────────────────────────────────────────────────
        let tools;
        if (serviceType === 'linkArticle') {
            // Article text is injected in prompt via scraping. urlContext causes empty responses.
            tools = [{ googleSearch: {} }];
        } else if (isDeepMode || enableGoogleSearch) {
            tools = [{ googleSearch: {} }];
        }
        const contents = [];

        if (videoUrl) {
            contents.push({
                role: 'user',
                parts: [
                    { fileData: { mimeType: 'video/mp4', fileUri: videoUrl } },
                    { text: prompt }
                ]
            });
        } else {
            contents.push({ role: 'user', parts: [{ text: prompt }] });
        }

        // ── Generate with retry for incomplete responses ──────────────────────────
        let responseText = '';
        let usage = null;
        let lastAttemptUsage = null;
        let totalPromptTokens = 0;
        let totalCandidatesTokens = 0;

        // Retries: linkArticle can occasionally return empty text; allow 1 retry even in deep single-call.
        const maxRetries = (serviceType === 'linkArticle' && isDeepMode) ? 1 : ((serviceType === 'linkArticle') ? 2 : 1);
        let lastValidation = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (videoUrl) {
                const stream = await ai.models.generateContentStream({
                    model: model || 'gemini-2.5-flash',
                    contents,
                    config: {
                        systemInstruction: (systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON. Complete ALL fields in the response.') + '\n\n' + getLanguageInstruction(lang),
                        temperature: 0.7,
                        maxOutputTokens: isDeepMode ? 65536 : 20000,
                        ...(tools ? {} : { responseMimeType: 'application/json', responseSchema: isDeepMode ? VIDEO_DEEP_SCHEMA : VIDEO_STANDARD_SCHEMA }),
                        mediaResolution: 'MEDIA_RESOLUTION_LOW',
                        tools
                    }
                });
                responseText = ''; // Reset for new attempt
                for await (const chunk of stream) {
                    if (chunk.text) responseText += chunk.text;
                    if (chunk.usageMetadata) {
                        lastAttemptUsage = chunk.usageMetadata;
                    }
                }
            } else {
                const jsonRuleShort = 'CRITICAL: Respond with exactly one valid JSON object. Start with {, end with }. No markdown. Escape " in strings as \\". Never truncate.';
                const sysInstr = (systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON.') + '\n\n' + getLanguageInstruction(lang) + '\n\n' + jsonRuleShort;
                const modelExtractor = MODELS.VIDEO_EXTRACTOR;
                const modelSynthesizer = MODELS.REPORT_SYNTHESIZER;

                // Single-call path for linkArticle (deep) — no stage1/stage2 embedding.
                if (serviceType === 'linkArticle' && isDeepMode) {
                    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                    const isRetryableGeminiTransportError = (e) => {
                        const msg = (e?.message || '').toLowerCase();
                        return msg.includes('fetch failed') ||
                            msg.includes('sending request') ||
                            msg.includes('aborterror') ||
                            msg.includes('aborted') ||
                            msg.includes('this operation was aborted') ||
                            msg.includes('econnreset') ||
                            msg.includes('etimedout') ||
                            msg.includes('enotfound');
                    };

                    const toolSets = [
                        // Best: AI Studio-style URL context + verification.
                        [
                            { urlContext: {} },
                            { googleSearch: { dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC', dynamicThreshold: 0 } } }
                        ],
                        // Fallback: verification only (no URL context).
                        [
                            { googleSearch: { dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC', dynamicThreshold: 0 } } }
                        ],
                        // Last resort: no tools at all (still must produce JSON).
                        undefined
                    ];

                    const budgets = [
                        { maxOutputTokens: 65536, thinkingBudget: 4000, temperature: 0.1 },
                        { maxOutputTokens: 32768, thinkingBudget: 1500, temperature: 0.2 }
                    ];

                    let finalResponse = null;
                    let finalUsageMeta = null;
                    let succeeded = false;

                    for (let pass = 0; pass < toolSets.length && !succeeded; pass++) {
                        for (let b = 0; b < budgets.length && !succeeded; b++) {
                            for (let netAttempt = 0; netAttempt < 3 && !succeeded; netAttempt++) {
                                try {
                                    finalResponse = await ai.models.generateContent({
                                        model: modelSynthesizer,
                                        contents,
                                        config: {
                                            systemInstruction: sysInstr,
                                            temperature: budgets[b].temperature,
                                            maxOutputTokens: budgets[b].maxOutputTokens,
                                            responseMimeType: 'application/json',
                                            responseSchema: LINK_RESPONSE_SCHEMA,
                                            thinkingConfig: { thinkingBudget: budgets[b].thinkingBudget },
                                            ...(toolSets[pass] ? { tools: toolSets[pass] } : {}),
                                            httpOptions: { timeout: 600000 }
                                        }
                                    });

                                    responseText = finalResponse?.text || '';
                                    finalUsageMeta = finalResponse?.usageMetadata || null;
                                    { const sm = extractSearchMetadata(finalResponse); logGoogleSearches(_dbgId + '_link_s1', sm.searchQueries, sm.groundingChunks); logThinking(_dbgId + '_link_s1', sm.thinkingText); }
                                    logRawResponse(_dbgId, `link_singlecall_pass${pass}_b${b}_n${netAttempt}`, responseText, finalUsageMeta);

                                    if (!responseText || responseText.trim().length < 5) {
                                        console.error('[LinkArticle] ❌ Empty response text (single-call). Will retry.');
                                        await sleep(400 + netAttempt * 800);
                                        continue;
                                    }

                                    succeeded = true;
                                    break;
                                } catch (e) {
                                    if (!isRetryableGeminiTransportError(e)) throw e;
                                    console.error(`[LinkArticle] ⚠️ Transport error (pass=${pass}, budget=${b}, netAttempt=${netAttempt}):`, e?.message || e);
                                    await sleep(700 + netAttempt * 1200);
                                }
                            }
                        }
                    }

                    if (!succeeded) {
                        // Let outer handler return 500 with a stable message.
                        throw new Error('AI_LINK_TRANSPORT_FAILURE');
                    }

                    totalPromptTokens = finalUsageMeta?.promptTokenCount || 0;
                    totalCandidatesTokens = finalUsageMeta?.candidatesTokenCount || 0;
                    usage = {
                        promptTokenCount: totalPromptTokens,
                        candidatesTokenCount: totalCandidatesTokens,
                        totalTokenCount: finalUsageMeta?.totalTokenCount || totalPromptTokens + totalCandidatesTokens,
                        details: [
                            { model: modelSynthesizer, ...(finalUsageMeta || {}) }
                        ]
                    };
                } else {
                    // Stage 1: Extraction (Flash)
                    const extractionConfig = {
                        systemInstruction: (systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON.') + '\n\n' + getLanguageInstruction(lang),
                        temperature: 0.1,
                        maxOutputTokens: 65536,
                        mediaResolution: 'MEDIA_RESOLUTION_LOW',
                        tools: tools // Flash handles the initial search/extraction
                    };

                    logSystemPrompt(_dbgId, extractionConfig.systemInstruction);
                    logUserPrompt(_dbgId, prompt, !!videoUrl);
                    const response = await ai.models.generateContent({
                        model: modelExtractor,
                        contents,
                        config: extractionConfig
                    });

                    const researchTokens = response.usageMetadata;
                    const rawText = response.text || '';
                    { const sm = extractSearchMetadata(response); logGoogleSearches(_dbgId + '_s1', sm.searchQueries, sm.groundingChunks); logThinking(_dbgId + '_s1', sm.thinkingText); }
                    logRawResponse(_dbgId, 'stage1_extraction', rawText, researchTokens);

                    // Stage 2: Smart Synthesis (Pro 3.1)
                    const videoContextStr = req.body.metadata?.title ? `VIDEO METADATA:\n- Title: ${req.body.metadata.title}\n\n` : '';
                    const synthesisContents = [
                        ...contents,
                        { role: 'user', parts: [{ text: `${videoContextStr}ESTABLISHED RESEARCH DATA (GROUND TRUTH):\n\n${rawText}\n\nINSTRUCTION: Using the data above and MARCH 2026 as current context, synthesize the final analysis exactly according to the schema. If needed, perform additional Google Search to verify the latest facts.` }] }
                    ];

                    const finalResponse = await ai.models.generateContent({
                        model: modelSynthesizer,
                        contents: synthesisContents,
                        config: {
                            temperature: 0.1,
                            maxOutputTokens: 65536,
                            responseMimeType: 'application/json',
                            responseSchema: serviceType === 'linkArticle' ? LINK_RESPONSE_SCHEMA : (isDeepMode ? VIDEO_DEEP_SCHEMA : VIDEO_STANDARD_SCHEMA),
                            thinkingConfig: { thinkingBudget: 4000 },
                            tools: [{
                                googleSearch: {
                                    dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC', dynamicThreshold: 0 }
                                }
                            }]
                        }
                    });

                    responseText = finalResponse.text || '';
                    const finalUsageMeta = finalResponse.usageMetadata;
                    { const sm = extractSearchMetadata(finalResponse); logGoogleSearches(_dbgId + '_s2', sm.searchQueries, sm.groundingChunks); logThinking(_dbgId + '_s2', sm.thinkingText); }
                    logRawResponse(_dbgId, 'stage2_synthesis', responseText, finalUsageMeta);

                    // Accumulate usage for billing
                    totalPromptTokens = (researchTokens?.promptTokenCount || 0) + (finalUsageMeta?.promptTokenCount || 0);
                    totalCandidatesTokens = (researchTokens?.candidatesTokenCount || 0) + (finalUsageMeta?.candidatesTokenCount || 0);
                    usage = {
                        promptTokenCount: totalPromptTokens,
                        candidatesTokenCount: totalCandidatesTokens,
                        details: [
                            { model: modelExtractor, ...researchTokens },
                            { model: modelSynthesizer, ...finalUsageMeta }
                        ]
                    };
                }
            }

            // ── Log raw response for debugging ──────────────────────────────────
            if (serviceType === 'linkArticle') {
                console.log(`[LinkArticle] Raw response length: ${responseText.length}`);
                console.log(`[LinkArticle] First 500 chars:`, responseText.substring(0, 500));
            }

            // ── Validate response ─────────────────────────────────────────────────
            lastValidation = validateJsonResponse(responseText, serviceType || 'video');
            if (lastValidation.valid) {
                // SUCCESS: Record the usage from this attempt
                if (lastAttemptUsage) {
                    totalPromptTokens = lastAttemptUsage.promptTokenCount || 0;
                    totalCandidatesTokens = lastAttemptUsage.candidatesTokenCount || 0;
                    usage = lastAttemptUsage;
                }
                // Quality gate for link analysis — reject empty results
                if (serviceType === 'linkArticle' && lastValidation.parsed) {
                    const p = lastValidation.parsed;
                    const hasRealContent = (p.summary && p.summary.length > 30) ||
                        (p.factualClaims && p.factualClaims.length > 0) ||
                        (p.manipulationTechniques && p.manipulationTechniques.length > 0);
                    if (!hasRealContent) {
                        console.error('[LinkArticle] ❌ QUALITY GATE: Analysis passed validation but has no real content');
                        lastValidation = { valid: false, code: 'AI_EMPTY_ANALYSIS' };
                        continue; // retry
                    }
                }
                break; // Success, exit retry loop
            }

            if (attempt >= maxRetries) break;
        }

        // Fallback for linkArticle: if tools caused empty/invalid response, retry without tools
        if (!lastValidation.valid && serviceType === 'linkArticle' && tools) {
            console.log('[LinkArticle] Fallback: retrying without googleSearch tools');
            const jsonRuleShort = 'CRITICAL: Respond with exactly one valid JSON object. Start with {, end with }. No markdown. Escape " in strings as \\". Never truncate.';
            const sysInstr = (systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON.') + '\n\n' + getLanguageInstruction(lang) + '\n\n' + jsonRuleShort;
            const fallbackResponse = await ai.models.generateContent({
                model: (serviceType === 'linkArticle' && isDeepMode) ? MODELS.REPORT_SYNTHESIZER : (model || 'gemini-2.5-flash'),
                contents,
                config: {
                    systemInstruction: sysInstr,
                    temperature: 0.7,
                    maxOutputTokens: 65536,
                    responseMimeType: 'application/json',
                    responseSchema: LINK_RESPONSE_SCHEMA
                }
            });
            if (fallbackResponse.usageMetadata) {
                totalPromptTokens = fallbackResponse.usageMetadata.promptTokenCount || 0;
                totalCandidatesTokens = fallbackResponse.usageMetadata.candidatesTokenCount || 0;
            }
            const fallbackText = fallbackResponse.text || '';
            lastValidation = validateJsonResponse(fallbackText, serviceType || 'link');
            if (lastValidation.valid) usage = fallbackResponse.usageMetadata || usage;
        }

        if (!lastValidation.valid) {
            return res.status(500).json({
                error: 'AI генерира непълен отговор. Моля, опитайте отново.',
                code: lastValidation.code
            });
        }

        // ── Calculate cost ────────────────────────────────────────────────────
        let finalPoints;
        if (isFixedPrice) {
            finalPoints = getFixedPrice(serviceType);
        } else {
            // Multi-stage usage accumulation
            const billingData = [];
            if (usage && usage.details) { // Check if usage contains details (hybrid)
                billingData.push(...usage.details);
            } else if (usage) { // Fallback for single-stage usage
                billingData.push({
                    model: model || MODELS.VIDEO_EXTRACTOR, // Default to extractor if model not specified
                    promptTokens: usage.promptTokenCount || 0,
                    candidatesTokens: usage.candidatesTokenCount || 0
                });
            }
            finalPoints = calculateVideoCostInPoints(billingData, isDeepMode);
        }

        // ── Prepare billing payload ──────────────────────────────────────────
        const billingPayload = {
            userId,
            billingIntentId: randomUUID(),
            points: finalPoints,
            serviceType,
            mode,
            metadata: {
                ...metadata,
                videoTitle: metadata.videoTitle || metadata.title || null,
                videoAuthor: metadata.videoAuthor || metadata.author || metadata.siteName || null,
                videoId: metadata.videoId || null,
                videoDuration: metadata.videoDuration || metadata.duration || null,
                thumbnailUrl: metadata.thumbnailUrl || null
            }
        };

        // Update balance in response object
        res.json({
            text: lastValidation.cleanedText || responseText,
            usageMetadata: usage,
            billingPayload, // Send to client for subsequent verification and finalization
            points: {
                costInPoints: finalPoints,
                isDeep: isDeepMode
            }
        });

    } catch (error) {
        console.error('[Gemini API] Error:', error.message);
        const msg = error.message || '';
        if (msg.includes('401') || msg.includes('API key')) {
            return res.status(401).json({ error: 'API key error', code: 'API_KEY_ERROR' });
        }
        res.status(500).json({ error: error.message || 'Failed to generate content', code: 'UNKNOWN_ERROR' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gemini/generate-stream — SSE Streaming for video analysis
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate-stream', requireAuth, analysisRateLimiter, async (req, res) => {
    req.setTimeout(900000);
    res.setTimeout(900000);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendSSE = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const abortController = new AbortController();
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 15000);
    req.on('close', () => {
        abortController.abort();
        clearInterval(heartbeat);
    });
    const endStream = () => {
        clearInterval(heartbeat);
        try { res.end(); } catch (_) { }
    };

    try {
        const ai = getAI();
        const userId = req.userId;
        const { model, prompt, systemInstruction, videoUrl, enableGoogleSearch, mode, serviceType, lang, metadata: reqMetadata } = req.body;
        const metadata = reqMetadata || {};
        const _dbgId = newRequestId();
        logRequest({ requestId: _dbgId, route: '/generate-stream', stage: 'init', model: model || 'auto', serviceType, mode, userId, hasGoogleSearch: !!(enableGoogleSearch || mode === 'deep') });
        logSystemPrompt(_dbgId, systemInstruction || '(ще бъде построен)');
        logUserPrompt(_dbgId, prompt, !!videoUrl);

        const isFixedPrice = serviceType && serviceType !== 'video';
        const isDeepMode = mode === 'deep';

        // ── Pre-flight balance check ──────────────────────────────────────────
        const currentBalance = await getUserPoints(userId);
        let minRequired;
        if (isFixedPrice) {
            minRequired = getFixedPrice(serviceType);
        } else {
            const duration = metadata.videoDuration || metadata.duration || 0;
            const estimated = estimateVideoCostInPoints(duration, isDeepMode);
            minRequired = Math.ceil(estimated * 1.2); // 20% safety buffer
        }

        if (currentBalance < minRequired) {
            sendSSE('error', { error: 'Insufficient points', code: 'INSUFFICIENT_POINTS', currentBalance });
            endStream();
            return;
        }

        // ── Build request ─────────────────────────────────────────────────────
        const tools = (isDeepMode || enableGoogleSearch) ? [{ googleSearch: {} }] : undefined;
        const contents = [{
            role: 'user',
            parts: videoUrl
                ? [{ fileData: { mimeType: 'video/mp4', fileUri: videoUrl } }, { text: prompt }]
                : [{ text: prompt }]
        }];

        sendSSE('progress', { status: getProgressMsg(lang, 'start') });

        // Strict JSON output — Gemini must return valid JSON; we do not repair complex breakage
        const jsonRule = [
            'CRITICAL — Your entire response MUST be exactly one valid JSON object.',
            'Start with { and end with }. No markdown (no ```), no text before or after.',
            'Inside string values: escape double quotes as \\", and escape newlines as \\n.',
            'Never truncate: always output the full JSON and close every bracket.',
            'Keep ALL schema fields populated (summary, claims, manipulations, etc.); only shorten long text strings if needed to avoid truncation. Always close all brackets and quotes.'
        ].join(' ');
        let enhancedSystemInstruction = (systemInstruction || '') + '\n\n' + getLanguageInstruction(lang) + '\n\n' + jsonRule;
        if (isDeepMode && tools) {
            enhancedSystemInstruction +=
                ' After tool use, respond with one complete JSON object only; integrate all tool results into it.';
        } else if (!systemInstruction) {
            enhancedSystemInstruction = 'You are a professional fact-checker. Your response must be valid JSON only.\n\n' + getLanguageInstruction(lang) + '\n\n' + jsonRule;
        }

        let fullText = '';
        let streamUsage = null;
        let chunkCount = 0;
        let functionCallCount = 0;
        let researchUsage = null;
        let finalUsage = null;
        let totalPromptTokens = 0;
        let totalCandidatesTokens = 0;
        /** Stage 1 multimodal blob — used to overwrite Pro 3.1 hallucinations in visual/vocal/body tabs */
        let deepStage1MultimodalRaw = null;
        /** Parsed Stage 1 JSON — fallback when Pro fills only placeholder tab arrays */
        let deepStage1Parsed = null;

        if (isDeepMode && tools) {
            // DEEP MODE: 1) Flash + video + googleSearch → Stage 1 JSON
            // 2) final JSON step with responseSchema (Pro)
            sendSSE('progress', { status: getProgressMsg(lang, 'deepPreparing') });

            const extractionConfig = {
                systemInstruction: enhancedSystemInstruction,
                temperature: 0.1,
                maxOutputTokens: 63536,
                mediaResolution: 'MEDIA_RESOLUTION_LOW',
                tools,
                abortSignal: abortController.signal,
                httpOptions: { timeout: 600000 } // 10 min for video + search
            };

            const response = await ai.models.generateContent({
                model: MODELS.VIDEO_EXTRACTOR,
                contents,
                config: extractionConfig
            });
            researchUsage = response.usageMetadata;
            streamUsage = response.usageMetadata || streamUsage;
            { const sm = extractSearchMetadata(response); logGoogleSearches(_dbgId + '_deep_s1', sm.searchQueries, sm.groundingChunks); logThinking(_dbgId + '_deep_s1', sm.thinkingText); }

            const parts = response.candidates?.[0]?.content?.parts;
            const hasFn = Array.isArray(parts) && parts.some(p => p?.functionCall || p?.function_call);
            if (hasFn) {
                console.error('[Gemini Stream] Deep: unexpected functionCall. Google Search should return direct text.');
                sendSSE('error', { error: 'AI returned unexpected format. Please try again.', code: 'AI_UNEXPECTED_FUNCTION_CALL' });
                endStream();
                return;
            }

            let rawText = '';
            if (typeof response.text === 'string') rawText = response.text;
            else if (typeof response.text === 'function') { try { rawText = response.text(); } catch (_) { } }
            else if (response.text != null && typeof response.text.then === 'function') { try { rawText = await response.text; } catch (_) { } }
            if (!rawText && parts?.length) {
                rawText = parts
                    .map(p => (p && typeof p === 'object' && p.text != null) ? String(p.text) : '')
                    .join('');
            }
            console.log('[Gemini Stream] Deep stage1 rawText length:', rawText?.length || 0, 'parts:', parts?.length || 0);

            // Extract authoritative multimodal observations from Stage 1 output.
            // This prevents Stage 2 (text-only) from inventing content for visual/body/vocal tabs.
            let stage1MultimodalObservations = '';
            const s1JsonTry = parseJsonRobust(rawText);
            if (s1JsonTry?.ok && s1JsonTry.parsed && typeof s1JsonTry.parsed === 'object') {
                deepStage1Parsed = s1JsonTry.parsed;
            }
            if (s1JsonTry?.ok && s1JsonTry.parsed && typeof s1JsonTry.parsed === 'object') {
                const mm = s1JsonTry.parsed.multimodalObservations;
                if (typeof mm === 'string' && mm.trim().length > 10) stage1MultimodalObservations = mm.trim();
            }
            if (!stage1MultimodalObservations) {
                // Fallback: rebuild from explicit markers found in the raw text.
                const markers = ['[VISUAL]', '[BODY LANGUAGE]', '[VOCAL]', '[DECEPTION]', '[HUMOR]'];
                const found = markers
                    .map(m => ({ m, i: rawText.indexOf(m) }))
                    .filter(x => x.i >= 0)
                    .sort((a, b) => a.i - b.i);
                if (found.length) {
                    const start = found[0].i;
                    stage1MultimodalObservations = rawText.substring(start).trim();
                }
            }
            // Flash often fills visualAnalysis[] etc. but leaves multimodalObservations empty — synthesize marker string
            if (s1JsonTry?.ok && s1JsonTry.parsed && typeof s1JsonTry.parsed === 'object') {
                const synthesized = serializeMultimodalFromStage1Arrays(s1JsonTry.parsed);
                if (synthesized.length > (stage1MultimodalObservations?.length || 0)) {
                    stage1MultimodalObservations = synthesized;
                }
            }
            if (!stage1MultimodalObservations || stage1MultimodalObservations.trim().length < 20) {
                stage1MultimodalObservations = 'MISSING_STAGE_1_MULTIMODAL_OBSERVATIONS';
            }
            deepStage1MultimodalRaw = stage1MultimodalObservations;
            if (deepStage1MultimodalRaw !== 'MISSING_STAGE_1_MULTIMODAL_OBSERVATIONS' && isLikelyMultimodalRefusal(deepStage1MultimodalRaw)) {
                deepStage1MultimodalRaw = 'MISSING_STAGE_1_MULTIMODAL_OBSERVATIONS';
            }

            const mmForPro = deepStage1MultimodalRaw !== 'MISSING_STAGE_1_MULTIMODAL_OBSERVATIONS'
                ? deepStage1MultimodalRaw
                : 'DERIVE_FROM_STAGE1_JSON: Populate the five multimodal tabs only from the arrays visualAnalysis, bodyLanguageAnalysis, vocalAnalysis, deceptionAnalysis, humorAnalysis inside the Stage 1 JSON above. Keep each item as analytic point + details; refine wording only; do not invent scenes.';

            // Build conversation for final JSON step (model's analysis as context)
            let currentContents = [...contents];
            // Any non-empty Stage 1 text must reach Pro — short replies used to skip context and broke Stage 2
            let hasGrounding = rawText && rawText.trim().length > 0;
            const durationMin = Math.round((metadata.videoDuration || metadata.duration || 0) / 60) || 10;
            const targetClaims = Math.min(20, Math.max(6, Math.round(durationMin * 0.6)));
            const targetManipulations = Math.min(10, Math.max(4, Math.round(durationMin * 0.4)));
            if (hasGrounding) {
                const todayStr = new Date().toLocaleDateString('en-US', { dateStyle: 'full' });
                const videoContextStr = metadata.title ? `VIDEO METADATA (Reference Point):\n- Title: ${metadata.title}\n- Author: ${metadata.author || 'Unknown'}\n- Duration: ~${durationMin} minutes\n- Uploaded/Published: ${metadata.date || 'Refer to content'}\n\n` : '';
                const verificationInstruction = `VERIFICATION RULE (today: ${todayStr}):
For EVERY claim: use Google Search to verify it against today's date. Return information current as of the moment this report is created. Verify events and cite accurate dates from your search results. Use the research above as base, but always confirm facts and dates via search.`;
                currentContents.push({
                    role: 'user',
                    parts: [{
                        text: `${videoContextStr}ESTABLISHED RESEARCH DATA (from Stage 1):\n\n${rawText.substring(0, 120000)}\n\nMULTIMODAL_OBSERVATIONS_FROM_STAGE_1 (ONLY for visual/body/vocal/behavioral tabs; authoritative):\n${mmForPro}\n\n${verificationInstruction}\n\nDo not use placeholders. Every claim MUST be evaluated against these findings.`
                    }]
                });
            }

            const multimodalRule = `For visualAnalysis, bodyLanguageAnalysis, vocalAnalysis, deceptionAnalysis, humorAnalysis:
- Source of truth: MULTIMODAL_OBSERVATIONS_FROM_STAGE_1 above, OR (if it says DERIVE_FROM_STAGE1_JSON) the visualAnalysis / bodyLanguageAnalysis / vocalAnalysis / deceptionAnalysis / humorAnalysis arrays inside ESTABLISHED RESEARCH DATA JSON. Do NOT invent AV content you cannot find there.
- Split into items where each "point" is a short analytic headline (thesis), "details" is 2–5 sentences of interpretation grounded in Stage 1 — NOT a timeline of mm:ss events unless Stage 1 used timestamps sparingly as anchors.
- Preserve participant names from Stage 1 when attributing behaviour; do not merge distinct people.
- Do NOT add new scenes/facts beyond Stage 1; you cannot see the video.
- If a category has no substance in Stage 1, return one fallback object:
  {"point":"No significant observations","details":"No significant observations were noted in the video analysis."}`;
            const jsonPromptsWithContext = [
                `Return the complete analysis as JSON. For each claim: verify via Google Search against today's date; give current information and accurate dates. For this ~${durationMin}-min video, aim for around ${targetClaims} claims and ${targetManipulations} manipulations. Populate EVERY array. ${multimodalRule} For psychologicalProfile, culturalSymbolicAnalysis: 4-6 items each, 2-4 sentences per "details" field. INTEGRATE research into explanation and logic. Ensure valid JSON. Do not truncate.`,
                `Format as valid JSON. Use the research above. For each claim: verify via Google Search against today; give current info and accurate dates. Aim for ~${targetClaims} claims and ~${targetManipulations} manipulations. ${multimodalRule} Populate all fields. No placeholders. Keep JSON complete.`
            ];
            const jsonPromptsNoContext = [
                'Return complete fact-check analysis as JSON. You do NOT have video — use ONLY the user text and MULTIMODAL_OBSERVATIONS_FROM_STAGE_1 for visual/body/vocal tabs. Populate claims/manipulations from available text. Be concise.',
                'Valid JSON only. No video input: never invent visual/audio/body observations; use MULTIMODAL_OBSERVATIONS_FROM_STAGE_1 or single-item fallback arrays. No placeholders.'
            ];
            const jsonPrompts = hasGrounding ? jsonPromptsWithContext : jsonPromptsNoContext;
            const finalConfig = {
                systemInstruction: enhancedSystemInstruction,
                tools: [{
                    googleSearch: {
                        dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC', dynamicThreshold: 0 }
                    }
                }],
                temperature: 0.1,
                maxOutputTokens: 65536,
                responseMimeType: 'application/json',
                responseSchema: VIDEO_DEEP_SCHEMA,
                thinkingConfig: { thinkingBudget: 4000 },
                httpOptions: { timeout: 300000 }
            };

            for (let attempt = 0; attempt < 2; attempt++) {
                if (attempt > 0) {
                    sendSSE('progress', { status: getProgressMsg(lang, 'retry') });
                    await new Promise(r => setTimeout(r, 1500));
                }
                sendSSE('progress', { status: getProgressMsg(lang, 'finalJson') });
                const jsonPrompt = { role: 'user', parts: [{ text: jsonPrompts[attempt] }] };
                const textContents = currentContents.map(c => ({
                    role: c.role,
                    parts: c.parts.filter(p => !p.fileData && !p.inlineData)
                }));
                const finalResponse = await ai.models.generateContent({
                    model: MODELS.REPORT_SYNTHESIZER,
                    contents: [...textContents, jsonPrompt],
                    config: finalConfig
                });
                finalUsage = finalResponse.usageMetadata;
                streamUsage = finalResponse.usageMetadata || streamUsage;
                { const sm = extractSearchMetadata(finalResponse); logGoogleSearches(_dbgId + `_deep_s2_att${attempt}`, sm.searchQueries, sm.groundingChunks); logThinking(_dbgId + `_deep_s2_att${attempt}`, sm.thinkingText); }

                fullText = '';
                if (typeof finalResponse.text === 'string') fullText = finalResponse.text;
                else if (typeof finalResponse.text === 'function') { try { fullText = finalResponse.text(); } catch (_) { } }
                else if (finalResponse.text != null && typeof finalResponse.text.then === 'function') { try { fullText = await finalResponse.text; } catch (_) { } }
                if (!fullText && finalResponse.candidates?.[0]?.content?.parts) {
                    fullText = finalResponse.candidates[0].content.parts
                        .map(p => (p && typeof p === 'object' && p.text != null) ? String(p.text) : '')
                        .join('');
                }
                fullText = fullText || '';

                const v = validateJsonResponse(fullText, serviceType || 'video');
                if (v.valid) break;
                if (attempt < 2 && (v.code === 'AI_JSON_PARSE_ERROR' || v.code === 'AI_INCOMPLETE_RESPONSE')) {
                    const p = v.parsed || {};
                    console.warn('[Gemini Stream] Deep attempt', attempt + 1, 'failed:', v.code, '| factualClaims:', p.factualClaims?.length, 'claims:', p.claims?.length, 'manipulationTechniques:', p.manipulationTechniques?.length);
                    continue;
                }
                break;
            }

            // Sum up Deep mode stages
            if (researchUsage) {
                totalPromptTokens += researchUsage.promptTokenCount || 0;
                totalCandidatesTokens += researchUsage.candidatesTokenCount || 0;
            }
            if (finalUsage) {
                totalPromptTokens += finalUsage.promptTokenCount || 0;
                totalCandidatesTokens += finalUsage.candidatesTokenCount || 0;
            }

            // Simulate streaming the result back to the UI
            const chunkSize = 2000;
            for (let i = 0; i < fullText.length; i += chunkSize) {
                sendSSE('progress', { status: getProgressMsg(lang, 'synthesizing', Math.round(i / 1024)) });
                await new Promise(r => setTimeout(r, 50));
            }

        } else {
            // STANDARD MODE: Hybrid 2-Stage (Flash Extraction + Pro Synthesis)
            sendSSE('progress', { status: getProgressMsg(lang, 'deepPreparing') }); // Reuse deepPreparing for consistency

            // Stage 1: Extraction (Flash)
            const extractionConfig = {
                systemInstruction: enhancedSystemInstruction,
                temperature: 0.1,
                maxOutputTokens: 20000,
                mediaResolution: 'MEDIA_RESOLUTION_LOW',
                tools: tools, // Integrated Google Search if enabled
                abortSignal: abortController.signal
            };

            const response = await ai.models.generateContent({
                model: MODELS.VIDEO_EXTRACTOR,
                contents,
                config: extractionConfig
            });
            researchUsage = response.usageMetadata;
            { const sm = extractSearchMetadata(response); logGoogleSearches(_dbgId + '_std_s1', sm.searchQueries, sm.groundingChunks); logThinking(_dbgId + '_std_s1', sm.thinkingText); }

            let rawText = '';
            if (typeof response.text === 'string') rawText = response.text;
            else if (typeof response.text === 'function') { try { rawText = response.text(); } catch (_) { } }
            if (!rawText && response.candidates?.[0]?.content?.parts) {
                rawText = response.candidates[0].content.parts
                    .map(p => (p && typeof p === 'object' && p.text != null) ? String(p.text) : '')
                    .join('');
            }

            // Stage 2: Report Generation (Pro 3.1)
            sendSSE('progress', { status: getProgressMsg(lang, 'finalJson') });

            const todayStr = new Date().toLocaleDateString('en-US', { dateStyle: 'full' });
            const videoContextStr = metadata.title ? `VIDEO METADATA:\n- Title: ${metadata.title}\n\n` : '';
            const textContents = contents.map(c => ({
                role: c.role,
                parts: c.parts.filter(p => !p.fileData && !p.inlineData)
            }));
            const verificationInstruction = `VERIFICATION RULE (today: ${todayStr}): For EVERY claim: use Google Search to verify against today's date. Return information current as of report creation. Verify events and cite accurate dates from search results.`;
            const synthesisContents = [
                ...textContents,
                { role: 'user', parts: [{ text: `${videoContextStr}ESTABLISHED RESEARCH DATA:\n\n${rawText}\n\n${verificationInstruction}\n\nINSTRUCTION: Using the findings above, synthesize the final JSON analysis. For each claim: verify via Google Search against today; give current info and accurate dates. You MUST include finalInvestigativeReport — a full official DCGE intelligence report (4–8 paragraphs) synthesizing all findings, verdicts, and key conclusions.` }] }
            ];

            const finalConfig = {
                systemInstruction: enhancedSystemInstruction,
                temperature: 0.1,
                maxOutputTokens: 65536,
                responseMimeType: 'application/json',
                responseSchema: VIDEO_STANDARD_SCHEMA,
                thinkingConfig: { thinkingBudget: 4000 },
                tools: [{
                    googleSearch: {
                        dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC', dynamicThreshold: 0 }
                    }
                }],
                abortSignal: abortController.signal,
                httpOptions: { timeout: 300000 }
            };

            const finalResponse = await ai.models.generateContent({
                model: MODELS.REPORT_SYNTHESIZER,
                contents: synthesisContents,
                config: finalConfig
            });

            finalUsage = finalResponse.usageMetadata;
            streamUsage = finalResponse.usageMetadata || streamUsage;
            { const sm = extractSearchMetadata(finalResponse); logGoogleSearches(_dbgId + '_std_s2', sm.searchQueries, sm.groundingChunks); logThinking(_dbgId + '_std_s2', sm.thinkingText); logRawResponse(_dbgId, 'std_stage2', fullText, finalUsage); }

            if (typeof finalResponse.text === 'string') fullText = finalResponse.text;
            else if (typeof finalResponse.text === 'function') { try { fullText = finalResponse.text(); } catch (_) { } }
            if (!fullText && finalResponse.candidates?.[0]?.content?.parts) {
                fullText = finalResponse.candidates[0].content.parts
                    .map(p => (p && typeof p === 'object' && p.text != null) ? String(p.text) : '')
                    .join('');
            }

            // Sum up Standard mode stages
            if (researchUsage) {
                totalPromptTokens += researchUsage.promptTokenCount || 0;
                totalCandidatesTokens += researchUsage.candidatesTokenCount || 0;
            }
            if (finalUsage) {
                totalPromptTokens += finalUsage.promptTokenCount || 0;
                totalCandidatesTokens += finalUsage.candidatesTokenCount || 0;
            }

            // Stream simulation
            const chunkSize = 2000;
            for (let i = 0; i < fullText.length; i += chunkSize) {
                sendSSE('progress', { status: getProgressMsg(lang, 'analyzing', Math.round(i / 1024)) });
                await new Promise(r => setTimeout(r, 50));
            }
        }

        clearInterval(heartbeat);

        const usage = streamUsage || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
        if (totalPromptTokens > 0 || totalCandidatesTokens > 0) {
            usage.promptTokenCount = totalPromptTokens;
            usage.candidatesTokenCount = totalCandidatesTokens;
            usage.totalTokenCount = totalPromptTokens + totalCandidatesTokens;
        }

        // ── Validate response ─────────────────────────────────────────────────
        let validation = validateJsonResponse(fullText, serviceType || 'video');
        if (!validation.valid) {
            console.error(`[Gemini Stream] Validation failed: ${validation.code}`, validation.error || '', `(${fullText.length} chars)`);

            if (fullText.length > 0) {
                console.error('[Gemini Stream] Failed response preview:', fullText.substring(0, 500));
            }

            const emptyMsg = validation.code === 'AI_EMPTY_RESPONSE'
                ? 'Моделът не върна съдържание. Опитайте отново след минута или изберете по-кратко видео.'
                : 'AI върна невалиден формат. Никакви точки не бяха таксувани.';
            try {
                sendSSE('error', { error: emptyMsg, code: validation.code, details: validation.error || 'Unknown validation error' });
            } catch (sendErr) {
                console.error('[Gemini Stream] Send error event failed:', sendErr?.message);
            }
            endStream();
            return;
        }

        // Deep: fill weak multimodal tabs from Stage 1 (per-tab), never replace good Stage 2 with parsed placeholders.
        if (isDeepMode && validation.parsed) {
            let v = validation.parsed;
            const apply = (patchObj) => {
                if (!patchObj) return;
                const { parsed: next, patched } = mergeMultimodalTabs(v, patchObj, true);
                if (patched) v = next;
            };
            if (deepStage1Parsed) {
                apply(pickMultimodalArraysFromParsed(deepStage1Parsed));
            }
            if (deepStage1MultimodalRaw && deepStage1MultimodalRaw !== 'MISSING_STAGE_1_MULTIMODAL_OBSERVATIONS') {
                const mmArrays = parseMultimodalObservationsToSchemaArrays(deepStage1MultimodalRaw);
                if (mmArrays) apply(mmArrays);
                const bare = bareMultimodalProseLen(deepStage1MultimodalRaw);
                if (bare >= 60) {
                    const mmNorm = normalizeMultimodalMarkerText(deepStage1MultimodalRaw).trim();
                    for (const k of multimodalArrayKeys()) {
                        if (!isPlaceholderArray(v[k])) continue;
                        apply({
                            [k]: [{ point: multimodalTabLabelFallback(lang, k), details: mmNorm }]
                        });
                    }
                }
            }
            stripRefusalFromMultimodalFields(v);
            validation = { valid: true, parsed: v, cleanedText: JSON.stringify(v) };
        }

        // ── Calculate cost ────────────────────────────────────────────────────
        const promptTokens = usage.promptTokenCount || 0;
        const candidatesTokens = usage.candidatesTokenCount || 0;

        let finalPoints;
        if (isFixedPrice) {
            finalPoints = getFixedPrice(serviceType);
        } else {
            const billingData = [];
            if (researchUsage) {
                billingData.push({
                    model: MODELS.VIDEO_EXTRACTOR,
                    promptTokens: researchUsage.promptTokenCount,
                    candidatesTokens: researchUsage.candidatesTokenCount,
                    hasVideo: true  // Flash обработва видео+аудио → различни цени
                });
            }
            if (finalUsage) {
                billingData.push({
                    model: MODELS.REPORT_SYNTHESIZER,
                    promptTokens: finalUsage.promptTokenCount,
                    candidatesTokens: finalUsage.candidatesTokenCount
                });
            }
            if (billingData.length === 0) {
                billingData.push({
                    model: MODELS.VIDEO_EXTRACTOR,
                    promptTokens,
                    candidatesTokens
                });
            }
            finalPoints = calculateVideoCostInPoints(billingData, isDeepMode);
        }

        const balanceNow = await getUserPoints(userId);
        if (balanceNow < finalPoints) {
            sendSSE('error', { error: 'Insufficient points.', code: 'INSUFFICIENT_POINTS', currentBalance: balanceNow });
            endStream();
            return;
        }

        // ── Prepare billing payload ──────────────────────────────────────────
        const billingPayload = {
            userId,
            billingIntentId: randomUUID(),
            points: finalPoints,
            serviceType: serviceType || 'video',
            mode,
            metadata: {
                ...metadata,
                videoTitle: metadata.title || metadata.videoTitle,
                videoAuthor: metadata.author || metadata.videoAuthor,
                videoId: metadata.videoId,
                videoDuration: metadata.duration,
                thumbnailUrl: metadata.thumbnailUrl
            }
        };

        const textToSend = validation.parsed ? JSON.stringify(validation.parsed) : fullText;
        
        sendSSE('progress', { status: getProgressMsg(lang, 'finalizing') });
        try {
            sendSSE('complete', {
                text: textToSend,
                usageMetadata: usage,
                billingPayload,
                points: { costInPoints: finalPoints, isDeep: isDeepMode }
            });
        } catch (e) {
            console.error('[Gemini Stream] Send failed:', e?.message);
            endStream();
            return;
        }

        // ── Log Real Token Costs to Server Console ────────────────────────────
        try {
            // Gemini 1.5 / 2.5 Flash Pricing
            // Media (Video/Audio) is included in promptTokenCount.
            let totalCostUsd = 0;
            let stage1Cost = 0;
            let stage2Cost = 0;
            if (researchUsage) {
                stage1Cost = calculateModelCostUSD(
                    MODELS.VIDEO_EXTRACTOR,
                    researchUsage.promptTokenCount || 0,
                    researchUsage.candidatesTokenCount || 0,
                    true  // hasVideo = true for Flash video input
                );
                totalCostUsd += stage1Cost;
            }
            if (finalUsage) {
                stage2Cost = calculateModelCostUSD(
                    MODELS.REPORT_SYNTHESIZER,
                    finalUsage.promptTokenCount || 0,
                    finalUsage.candidatesTokenCount || 0,
                    false  // Pro 3.1 receives text-only
                );
                totalCostUsd += stage2Cost;
            }

            console.log('\n=========================================');
            console.log(`🧠 [${isDeepMode ? 'DEEP' : 'STANDARD'}] API USAGE REPORT`);
            console.log(`=========================================`);
            console.log(`► Type: ${isDeepMode ? 'Deep' : 'Standard'} Analysis`);
            if (researchUsage) {
                console.log(`  ▸ Stage 1 (Flash 2.5 — Video Input):`);
                console.log(`    Prompt: ${(researchUsage.promptTokenCount || 0).toLocaleString()} | Output: ${(researchUsage.candidatesTokenCount || 0).toLocaleString()} | Cost: $${stage1Cost.toFixed(4)}`);
            }
            if (finalUsage) {
                console.log(`  ▸ Stage 2 (Pro 3.1 — Synthesis):`);
                console.log(`    Prompt: ${(finalUsage.promptTokenCount || 0).toLocaleString()} | Output: ${(finalUsage.candidatesTokenCount || 0).toLocaleString()} | Cost: $${stage2Cost.toFixed(4)}`);
            }
            console.log(`► Total Tokens: ${(promptTokens + candidatesTokens).toLocaleString()}`);
            console.log(`► Real API Cost: $${totalCostUsd.toFixed(6)} USD`);
            console.log(`► Points Deducted: ${finalPoints} pts`);
            console.log(`=========================================\n`);
        } catch (e) {
            console.log('[Cost Logger Error]', e.message);
        }

        // sendSSE('points_deducted', { newBalance }); // Removed, handled by client call
        endStream();

    } catch (error) {
        if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') {
            endStream();
            return;
        }
        console.error('[Gemini Stream API] Error:', error?.message || error);
        try {
            sendSSE('error', { error: error.message || 'Failed to generate content', code: 'UNKNOWN_ERROR' });
        } catch (writeErr) {
            console.error('[Gemini Stream API] Could not send error SSE:', writeErr.message);
        }
        endStream();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gemini/synthesize-report — Report synthesis (no billing)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/synthesize-report', requireAuth, analysisRateLimiter, async (req, res) => {
    req.setTimeout(300000); // 5 minutes
    res.setTimeout(300000);

    try {
        const ai = getAI();
        const { prompt, lang } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

        const baseSys = 'Ти си главен редактор на разследващо издание. Докладът трябва да е ПОДРОБЕН: всяка секция поне няколко параграфа, конкретни твърдения и разсъждения. Кратките и повърхностни отговори са неприемливи.';
        const sysInstr = baseSys + ' ' + getLanguageInstruction(lang);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                temperature: 0.7,
                maxOutputTokens: 32000,
                systemInstruction: sysInstr
            }
        });

        let reportText = '';
        if (typeof response.text === 'string') reportText = response.text;
        else if (typeof response.text === 'function') reportText = response.text();
        else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
            reportText = response.candidates[0].content.parts[0].text;
        }

        res.json({ report: reportText });
    } catch (error) {
        console.error('[Report Synthesis] Error:', error?.message || error);
        res.status(500).json({ error: error.message || 'Report synthesis failed' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gemini/finalize-billing — Finalize point deduction after client UI verification
// ─────────────────────────────────────────────────────────────────────────────
router.post('/finalize-billing', requireAuth, async (req, res) => {
    try {
        const { billingPayload } = req.body;
        if (!billingPayload || !billingPayload.userId || billingPayload.points === undefined) {
            return res.status(400).json({ error: 'Invalid billing payload' });
        }

        // Security check: must belong to the same user
        if (billingPayload.userId !== req.userId) {
            return res.status(403).json({ error: 'Unauthorized billing request' });
        }

        const { userId, points, serviceType, mode, metadata, billingIntentId } = billingPayload;

        let description = 'Анализ на съдържание';
        if (serviceType === 'linkArticle') {
            description = 'Анализ на статия (Линк)';
        } else if (serviceType === 'text') {
            description = 'Текстов анализ';
        } else {
            description = mode === 'deep' ? 'Дълбок видео анализ' : 'Стандартен видео анализ';
        }

        const deductResult = await deductPointsFromUser(userId, points, description, metadata, billingIntentId || null);
        if (!deductResult.success) {
            return res.status(403).json({
                error: 'Insufficient points for finalization.',
                code: 'INSUFFICIENT_POINTS',
                currentBalance: deductResult.newBalance
            });
        }

        if (!deductResult.alreadyProcessed) {
            logActivity(userId, serviceType === 'linkArticle' ? 'analysis_link' : 'analysis_video', { points }).catch(() => { });
        }

        res.json({
            success: true,
            newBalance: deductResult.newBalance,
            pointsDeducted: deductResult.alreadyProcessed ? 0 : points,
            alreadyProcessed: !!deductResult.alreadyProcessed
        });
    } catch (error) {
        console.error('[Gemini Billing] Error:', error.message);
        res.status(500).json({ error: 'Failed to finalize billing', code: 'BILLING_ERROR' });
    }
});

export { validateJsonResponse };
export default router;
