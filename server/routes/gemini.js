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
    getFixedPrice
} from '../config/pricing.js';
import { logActivity } from '../../admin/server/activityLogger.js';
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
        finalJson: 'Заявка за финален JSON отговор...',
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

// Lean claim item — only the minimum required by the UI transform
const CLAIM_ITEM = {
    type: 'object',
    properties: {
        claim: { type: 'string' },
        verdict: { type: 'string' },
        evidence: { type: 'string' },
        speaker: { type: 'string' },
        timestamp: { type: 'string' }
    },
    required: ['claim', 'verdict']
};

const MANIPULATION_ITEM = {
    type: 'object',
    properties: {
        technique: { type: 'string' },
        description: { type: 'string' },
        example: { type: 'string' },
        impact: { type: 'string' },
        counterArgument: { type: 'string' },
        timestamp: { type: 'string' }
    },
    required: ['technique', 'description']
};

// Lean VIDEO_RESPONSE_SCHEMA — only enforces critical fields.
// Gemini's 400 "too many states" error is caused by schemas with:
//   - many properties, large maxItems, nested enums, nested typed arrays.
// Solution: constrain only required fields; all other fields come back as free JSON.
const VIDEO_RESPONSE_SCHEMA = {
    type: 'object',
    required: ['summary', 'overallAssessment'],
    properties: {
        summary: { type: 'string' },
        overallAssessment: { type: 'string' },
        detailedMetrics: { type: 'object' },
        factualClaims: { type: 'array', items: CLAIM_ITEM },
        claims: { type: 'array', items: CLAIM_ITEM },
        manipulationTechniques: { type: 'array', items: MANIPULATION_ITEM },
        finalInvestigativeReport: { type: 'string' },
        quotes: { type: 'array', items: { type: 'object' } },
        visualAnalysis: { type: 'array', items: POINT_DETAILS_ITEM },
        bodyLanguageAnalysis: { type: 'array', items: POINT_DETAILS_ITEM },
        vocalAnalysis: { type: 'array', items: POINT_DETAILS_ITEM },
        deceptionAnalysis: { type: 'array', items: POINT_DETAILS_ITEM },
        humorAnalysis: { type: 'array', items: POINT_DETAILS_ITEM },
        psychologicalProfile: { type: 'array', items: POINT_DETAILS_ITEM },
        culturalSymbolicAnalysis: { type: 'array', items: POINT_DETAILS_ITEM },
        geopoliticalContext: { type: 'array', items: { type: 'object' } },
        historicalParallel: { type: 'array', items: { type: 'object' } },
        psychoLinguisticAnalysis: { type: 'array', items: { type: 'object' } },
        strategicIntent: { type: 'array', items: { type: 'object' } },
        narrativeArchitecture: { type: 'array', items: { type: 'object' } },
        technicalForensics: { type: 'array', items: { type: 'object' } },
        socialImpactPrediction: { type: 'array', items: { type: 'object' } },
        recommendations: { type: 'array', items: { type: 'object' } },
        biasIndicators: { type: 'object' }
    }
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
        headlineAnalysis: { type: 'object' },
        factualClaims: { type: 'array', items: { type: 'object' } },
        manipulationTechniques: { type: 'array', items: { type: 'object' } },
        alternativeSources: { type: 'array', items: { type: 'object' } },
        commentsAnalysis: { type: 'object' }
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

        // ── Determine cost type ───────────────────────────────────────────────
        const isFixedPrice = serviceType && serviceType !== 'video';
        const isDeepMode = mode === 'deep';

        // ── Pre-flight balance check ──────────────────────────────────────────
        const currentBalance = await getUserPoints(userId);
        const minRequired = isFixedPrice
            ? getFixedPrice(serviceType)
            : (isDeepMode ? 10 : 5);

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
        let totalPromptTokens = 0;
        let totalCandidatesTokens = 0;
        const accumulateUsage = (u) => {
            if (u) {
                totalPromptTokens += u.promptTokenCount || 0;
                totalCandidatesTokens += u.candidatesTokenCount || 0;
            }
        };
        // Extra retries only for link analysis (larger JSON); video stays at 1 to avoid long waits
        const maxRetries = (serviceType === 'linkArticle') ? 2 : 1;
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
                        ...(tools ? {} : { responseMimeType: 'application/json', responseSchema: VIDEO_RESPONSE_SCHEMA }),
                        mediaResolution: 'MEDIA_RESOLUTION_LOW',
                        tools
                    }
                });
                responseText = ''; // Reset for new attempt
                for await (const chunk of stream) {
                    if (chunk.text) responseText += chunk.text;
                    if (chunk.usageMetadata) {
                        accumulateUsage(chunk.usageMetadata);
                        usage = chunk.usageMetadata;
                    }
                }
            } else {
                const jsonRuleShort = 'CRITICAL: Respond with exactly one valid JSON object. Start with {, end with }. No markdown. Never truncate.';
                const todayStr = new Date().toISOString().slice(0, 10);
                const dateInstr = serviceType === 'linkArticle'
                    ? 'IMPORTANT: Today is ' + todayStr + '. Use Google Search to verify ALL current facts, political positions, and recent events. Do NOT rely on training data alone for time-sensitive facts — especially: current heads of state, election results, recent appointments, ongoing conflicts.'
                    : '';
                const sysInstr = (systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON.')
                    + '\n\n' + getLanguageInstruction(lang)
                    + (dateInstr ? '\n\n' + dateInstr : '')
                    + '\n\n' + jsonRuleShort;
                const response = await ai.models.generateContent({
                    model: model || 'gemini-2.5-flash',
                    contents,
                    config: {
                        systemInstruction: sysInstr,
                        temperature: 0.7,
                        maxOutputTokens: 65536, // Gemini 2.5 Flash supports up to 64K output tokens
                        ...(tools ? {} : { responseMimeType: 'application/json', responseSchema: serviceType === 'linkArticle' ? LINK_RESPONSE_SCHEMA : VIDEO_RESPONSE_SCHEMA }),
                        tools
                    }
                });
                responseText = response.text || '';
                accumulateUsage(response.usageMetadata);
                usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };
            }

            // ── Log raw response for debugging ──────────────────────────────────
            if (serviceType === 'linkArticle') {
                console.log(`[LinkArticle] Raw response length: ${responseText.length}`);
                console.log(`[LinkArticle] First 500 chars:`, responseText.substring(0, 500));
            }

            // ── Validate response ─────────────────────────────────────────────────
            lastValidation = validateJsonResponse(responseText, serviceType || 'video');
            if (lastValidation.valid) {
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

        // Fallback for linkArticle: if tools caused empty response, retry without tools
        if (!lastValidation.valid && serviceType === 'linkArticle' && tools) {
            console.log('[LinkArticle] Fallback: retrying without googleSearch tools');
            const jsonRuleShort = 'CRITICAL: Respond with exactly one valid JSON object. Start with {, end with }. No markdown. Escape " in strings as \\". Never truncate.';
            const todayStr = new Date().toISOString().slice(0, 10);
            const dateInstr = serviceType === 'linkArticle'
                ? 'IMPORTANT: Today is ' + todayStr + '. Use Google Search to verify ALL current facts, political positions, and recent events. Do NOT rely on training data for facts that may have changed — especially: current heads of state, election results, recent appointments, ongoing wars/conflicts.'
                : '';
            const sysInstr = (systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON.')
                + '\n\n' + getLanguageInstruction(lang)
                + (dateInstr ? '\n\n' + dateInstr : '')
                + '\n\n' + jsonRuleShort;
            const fallbackResponse = await ai.models.generateContent({
                model: model || 'gemini-2.5-flash',
                contents,
                config: {
                    systemInstruction: sysInstr,
                    temperature: 0.7,
                    maxOutputTokens: 65536,
                    responseMimeType: 'application/json',
                    responseSchema: LINK_RESPONSE_SCHEMA
                }
            });
            accumulateUsage(fallbackResponse.usageMetadata);
            const fallbackText = fallbackResponse.text || '';
            if (fallbackText.length > 100) {
                lastValidation = validateJsonResponse(fallbackText, 'link');
                if (lastValidation.valid) usage = fallbackResponse.usageMetadata || usage;
            }
        }

        if (!lastValidation.valid) {
            return res.status(500).json({
                error: 'AI генерира непълен отговор. Моля, опитайте отново.',
                code: lastValidation.code
            });
        }

        // ── Calculate cost ────────────────────────────────────────────────────
        const promptTokens = (totalPromptTokens > 0 || totalCandidatesTokens > 0)
            ? totalPromptTokens : (usage?.promptTokenCount || 0);
        const candidatesTokens = (totalPromptTokens > 0 || totalCandidatesTokens > 0)
            ? totalCandidatesTokens : (usage?.candidatesTokenCount || 0);

        let finalPoints;
        if (isFixedPrice) {
            finalPoints = getFixedPrice(serviceType);
        } else {
            finalPoints = calculateVideoCostInPoints(promptTokens, candidatesTokens, isDeepMode, isBatch, model);
        }

        // ── Deduct points SERVER-SIDE ─────────────────────────────────────────
        // Only deduct if we are ready to send success response
        if (lastValidation.valid) {
            let description = 'Анализ на съдържание';
            if (serviceType === 'linkArticle') {
                description = 'Анализ на статия (Линк)';
            } else if (serviceType === 'text') {
                description = 'Текстов анализ';
            } else {
                description = isDeepMode ? 'Дълбок видео анализ' : 'Стандартен видео анализ';
            }

            // Extract metadata if exists (e.g. for link analysis title)
            const metadata = req.body.metadata || {};

            const deductResult = await deductPointsFromUser(userId, finalPoints, description, metadata);
            if (!deductResult.success) {
                return res.status(403).json({
                    error: 'Insufficient points after generation.',
                    code: 'INSUFFICIENT_POINTS',
                    currentBalance: deductResult.newBalance
                });
            }
            logActivity(userId, serviceType === 'linkArticle' ? 'analysis_link' : 'analysis_video', { points: finalPoints }).catch(() => { });

            // Update balance in response object
            res.json({
                text: lastValidation.cleanedText || responseText,
                usageMetadata: usage,
                points: {
                    deducted: finalPoints,
                    costInPoints: finalPoints,
                    newBalance: deductResult.newBalance,
                    isDeep: isDeepMode
                }
            });
        } else {
            // Should verify validation logic doesn't already handle this
            // Use exiting error block
            throw new Error('Unexpected validation state');
        }

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
        const { model, prompt, systemInstruction, videoUrl, isBatch, enableGoogleSearch, mode, serviceType, lang } = req.body;

        const isFixedPrice = serviceType && serviceType !== 'video';
        const isDeepMode = mode === 'deep';

        // ── Pre-flight balance check ──────────────────────────────────────────
        const currentBalance = await getUserPoints(userId);
        const minRequired = isFixedPrice
            ? getFixedPrice(serviceType)
            : (isDeepMode ? 10 : 5);

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
                ? [{ fileData: { fileUri: videoUrl } }, { text: prompt }]
                : [{ text: prompt }]
        }];

        sendSSE('progress', { status: getProgressMsg(lang, 'start') });

        // Strict JSON output — Gemini must return valid JSON; we do not repair complex breakage
        const jsonRule = [
            'CRITICAL — Your entire response MUST be exactly one valid JSON object.',
            'Start with { and end with }. No markdown (no ```), no text before or after.',
            'Inside string values: escape double quotes as \\", and escape newlines as \\n.',
            'Never truncate: always output the full JSON and close every bracket.',
            'Keep ALL schema fields populated (summary, overallAssessment, detailedMetrics, factualClaims, manipulationTechniques, etc.); only shorten long text strings if needed to avoid truncation. Always close all brackets and quotes.'
        ].join(' ');
        const todayStr = new Date().toISOString().slice(0, 10);
        const dateNote = `IMPORTANT: Today's date is ${todayStr}. When verifying facts, always consider the current date — do not assume your training knowledge is up to date.`;
        let enhancedSystemInstruction = (systemInstruction || '') + '\n\n' + getLanguageInstruction(lang) + '\n\n' + dateNote + '\n\n' + jsonRule;
        if (isDeepMode && tools) {
            enhancedSystemInstruction +=
                ' After tool use, respond with one complete JSON object only; integrate all tool results into it.';
        } else if (!systemInstruction) {
            enhancedSystemInstruction = 'You are a professional fact-checker. Your response must be valid JSON only.\n\n' + getLanguageInstruction(lang) + '\n\n' + dateNote + '\n\n' + jsonRule;
        }

        let fullText = '';
        let streamUsage = null;
        let chunkCount = 0;
        let functionCallCount = 0;
        let totalPromptTokens = 0;
        let totalCandidatesTokens = 0;
        const accumulateUsage = (u) => {
            if (u) {
                totalPromptTokens += u.promptTokenCount || 0;
                totalCandidatesTokens += u.candidatesTokenCount || 0;
            }
        };

        if (isDeepMode && tools) {
            // DEEP MODE: 1) generateContent with googleSearch (Google does search on its servers)
            // 2) ALWAYS final JSON step with responseSchema — guarantees valid JSON (tools + schema incompatible)
            sendSSE('progress', { status: getProgressMsg(lang, 'deepPreparing') });

            const toolConfig = {
                systemInstruction: enhancedSystemInstruction,
                temperature: 0.7,
                maxOutputTokens: 63536,
                mediaResolution: 'MEDIA_RESOLUTION_LOW',
                tools,
                abortSignal: abortController.signal,
                httpOptions: { timeout: 600000 } // 10 min for video + search
            };

            console.log('[Deep] Stage1 starting — videoUrl:', videoUrl ? videoUrl.substring(0, 80) : 'none', '| model:', model || 'gemini-2.5-flash', '| hasTools:', !!tools);
            let response;
            const stage1MaxRetries = 3;
            for (let s1attempt = 0; s1attempt < stage1MaxRetries; s1attempt++) {
                try {
                    if (s1attempt > 0) {
                        console.log('[Deep] Stage1 retry', s1attempt, '— waiting 3s...');
                        sendSSE('progress', { status: getProgressMsg(lang, 'deepPreparing') });
                        await new Promise(r => setTimeout(r, 3000));
                    }
                    response = await ai.models.generateContent({
                        model: model || 'gemini-2.5-flash',
                        contents,
                        config: toolConfig
                    });
                    break; // success
                } catch (stage1Err) {
                    const msg = stage1Err?.message || '';
                    const isTransient = msg.includes('fetch failed') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('socket hang up');
                    console.error('[Deep] Stage1 attempt', s1attempt + 1, 'FAILED —', msg);
                    if (isTransient && s1attempt < stage1MaxRetries - 1) {
                        console.log('[Deep] Stage1 transient error — will retry');
                        continue;
                    }
                    console.error('[Deep] Stage1 FINAL FAIL — videoUrl:', videoUrl);
                    throw stage1Err;
                }
            }
            accumulateUsage(response.usageMetadata);
            streamUsage = response.usageMetadata || streamUsage;

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

            // Build contents for final JSON step.
            // IMPORTANT: Do NOT send raw stage-1 parts as { role: 'model' } — they contain
            // grounding metadata objects that the API rejects in multi-turn history, which
            // causes Gemini to ignore the video when generating the final JSON.
            // Instead: fresh single-turn request = video + prompt that embeds stage-1 text.
            const stage1Summary = rawText && rawText.trim().length > 50
                ? rawText.trim().substring(0, 12000) // cap to avoid token overflow
                : null;
            const hasGrounding = !!stage1Summary;
            console.log('[Deep] Stage1 result — hasGrounding:', hasGrounding, '| rawText chars:', rawText?.length || 0, '| parts:', parts?.length || 0);

            // Final JSON step — schema-validated, no tools (API restriction).
            // Fresh single-turn requests: video included directly + stage-1 research injected as text.
            const MULTIMODAL_INSTRUCTION = 'DIRECT VIDEO ANALYSIS REQUIRED: Watch and listen to the video carefully. Analyze these fields from the video itself — visualAnalysis (environment, objects, symbols, camera angles, lighting), bodyLanguageAnalysis (posture, gestures, microexpressions, eye contact per speaker), vocalAnalysis (tone, pitch, pace, hesitations, emphasis), deceptionAnalysis (credibility score, deception indicators, cognitive load), humorAnalysis (type of humor, purpose, manipulative vs genuine), psychologicalProfile (personality traits, power dynamics, manipulation tactics per speaker), culturalSymbolicAnalysis (cultural references, dog whistles, archetypes, symbols). Each item: {"point": "...", "details": "..."}. Minimum 2 items per array. Do NOT leave these empty.';

            const groundingBlock = stage1Summary
                ? `\n\nGOOGLE SEARCH RESEARCH (use for factual verification):\n${stage1Summary}\n`
                : '';

            const promptMain = `You are analyzing the video attached to this message. Return a complete fact-check as valid JSON.${groundingBlock}

STEPS:
1. For factualClaims: use the Google Search research above to verify each claim. Each item needs: claim, verdict, evidence, sources, speaker, timestamp, logicalAnalysis, factualVerification, comparison.
2. For manipulationTechniques: technique, description, example, impact, counterArgument, timestamp, severity.
3. ${MULTIMODAL_INSTRUCTION}
4. Populate: finalInvestigativeReport (min 15 paragraphs), summary (8+ sentences), overallAssessment (ACCURATE/MOSTLY_ACCURATE/MIXED/MISLEADING/FALSE), detailedMetrics, geopoliticalContext, historicalParallel, psychoLinguisticAnalysis, strategicIntent, narrativeArchitecture, technicalForensics, socialImpactPrediction — all as [{point, details}].
5. Aim for 5+ factualClaims, 3+ manipulationTechniques, 2+ items per multimodal array. Never truncate. Always close all brackets.`;

            const promptRetry = `Complete the analysis of the attached video. Return valid JSON with ALL fields.${groundingBlock}
factualClaims (claim, verdict, evidence), manipulationTechniques (technique, description, example, impact, counterArgument).
${MULTIMODAL_INSTRUCTION}
finalInvestigativeReport: comprehensive synthesis. Never leave arrays empty. Never truncate.`;

            const makeContents = (promptText) => videoUrl
                ? [{ role: 'user', parts: [{ fileData: { fileUri: videoUrl } }, { text: promptText }] }]
                : [{ role: 'user', parts: [{ text: promptText }] }];

            const stage2Contents = [makeContents(promptMain), makeContents(promptRetry)];
            const finalConfig = {
                ...toolConfig,
                tools: undefined,
                responseMimeType: 'application/json',
                responseSchema: VIDEO_RESPONSE_SCHEMA,
                httpOptions: { timeout: 300000 } // 5 min for JSON step
            };

            for (let attempt = 0; attempt < 2; attempt++) {
                if (attempt > 0) {
                    sendSSE('progress', { status: getProgressMsg(lang, 'retry') });
                    await new Promise(r => setTimeout(r, 1500));
                }
                sendSSE('progress', { status: getProgressMsg(lang, 'finalJson') });
                console.log('[Deep] Stage2 attempt', attempt + 1, '— sending', videoUrl ? 'video+prompt' : 'text-only', '| grounding block chars:', groundingBlock.length);
                const finalResponse = await ai.models.generateContent({
                    model: model || 'gemini-2.5-flash',
                    contents: stage2Contents[attempt] || stage2Contents[0],
                    config: finalConfig
                });
                console.log('[Deep] Stage2 attempt', attempt + 1, '— raw response candidates:', finalResponse.candidates?.length, '| finishReason:', finalResponse.candidates?.[0]?.finishReason);
                accumulateUsage(finalResponse.usageMetadata);
                streamUsage = finalResponse.usageMetadata || streamUsage;

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
                console.log('[Deep] Stage2 attempt', attempt + 1, '— fullText chars:', fullText.length, '| starts with {:', fullText.trimStart().startsWith('{'));

                const v = validateJsonResponse(fullText, serviceType || 'video');
                if (v.valid) {
                    // Log field summary on success
                    const p = v.parsed || {};
                    console.log('[Deep] Stage2 SUCCESS — fields summary:', {
                        summary: p.summary ? p.summary.length + ' chars' : 'MISSING',
                        overallAssessment: p.overallAssessment || 'MISSING',
                        factualClaims: p.factualClaims?.length ?? 'MISSING',
                        manipulationTechniques: p.manipulationTechniques?.length ?? 'MISSING',
                        visualAnalysis: p.visualAnalysis?.length ?? 'MISSING',
                        bodyLanguageAnalysis: p.bodyLanguageAnalysis?.length ?? 'MISSING',
                        vocalAnalysis: p.vocalAnalysis?.length ?? 'MISSING',
                        deceptionAnalysis: p.deceptionAnalysis?.length ?? 'MISSING',
                        humorAnalysis: p.humorAnalysis?.length ?? 'MISSING',
                        psychologicalProfile: p.psychologicalProfile?.length ?? 'MISSING',
                        culturalSymbolicAnalysis: p.culturalSymbolicAnalysis?.length ?? 'MISSING',
                        finalInvestigativeReport: p.finalInvestigativeReport ? p.finalInvestigativeReport.length + ' chars' : 'MISSING',
                    });
                    break;
                }
                if (attempt < 2 && (v.code === 'AI_JSON_PARSE_ERROR' || v.code === 'AI_INCOMPLETE_RESPONSE')) {
                    const p = v.parsed || {};
                    console.warn('[Deep] Stage2 attempt', attempt + 1, 'FAILED:', v.code, '| partial fields:', {
                        factualClaims: p.factualClaims?.length ?? 'none',
                        manipulationTechniques: p.manipulationTechniques?.length ?? 'none',
                        visualAnalysis: p.visualAnalysis?.length ?? 'none',
                        bodyLanguageAnalysis: p.bodyLanguageAnalysis?.length ?? 'none',
                    });
                    continue;
                }
                console.warn('[Deep] Stage2 attempt', attempt + 1, 'FAILED (no retry):', v.code);
                break;
            }

            // Simulate streaming the result back to the UI
            const chunkSize = 2000;
            for (let i = 0; i < fullText.length; i += chunkSize) {
                sendSSE('progress', { status: getProgressMsg(lang, 'synthesizing', Math.round(i / 1024)) });
                await new Promise(r => setTimeout(r, 50));
            }

        } else {
            // STANDARD MODE: streaming first, retry with non-streaming on validation failure
            // When tools (Google Search) are active: use non-streaming generateContent for speed.
            // Streaming + tools is very slow (multiple search rounds during stream). Non-streaming is 3-4x faster.
            if (tools) {
                sendSSE('progress', { status: getProgressMsg(lang, 'deepPreparing') });
                console.log('[Standard+Search] Using non-streaming generateContent with Google Search');
                const searchConfig = {
                    systemInstruction: enhancedSystemInstruction,
                    temperature: 0.7,
                    maxOutputTokens: 63536,
                    mediaResolution: 'MEDIA_RESOLUTION_LOW',
                    tools,
                    httpOptions: { timeout: 300000 }
                };
                const searchResponse = await ai.models.generateContent({
                    model: model || 'gemini-2.5-flash',
                    contents,
                    config: searchConfig
                });
                accumulateUsage(searchResponse.usageMetadata);
                streamUsage = searchResponse.usageMetadata || streamUsage;
                if (typeof searchResponse.text === 'string') fullText = searchResponse.text;
                else if (searchResponse.candidates?.[0]?.content?.parts) {
                    fullText = searchResponse.candidates[0].content.parts
                            .map(p => (p && typeof p === 'object' && p.text != null) ? String(p.text) : '')
                            .join('');
                }
                fullText = fullText || '';
                console.log('[Standard+Search] Response chars:', fullText.length, '| starts with {:', fullText.trimStart().startsWith('{'));
                // If Google Search response is not valid JSON, do a schema-based JSON extraction pass
                const searchValidation = validateJsonResponse(fullText, serviceType || 'video');
                if (!searchValidation.valid && fullText.length > 50) {
                    sendSSE('progress', { status: getProgressMsg(lang, 'finalJson') });
                    console.log('[Standard+Search] Search response not valid JSON — extracting JSON with schema');
                    const jsonPromptText = 'You just analyzed the video and researched facts via Google Search. Now return ONLY a valid JSON object with all findings. Watch the video directly for: factualClaims, manipulationTechniques, summary, overallAssessment, detailedMetrics. Never truncate. Always close all brackets.';
                    const jsonConfig = {
                        systemInstruction: enhancedSystemInstruction,
                        temperature: 0.7,
                        maxOutputTokens: 63536,
                        responseMimeType: 'application/json',
                        responseSchema: VIDEO_RESPONSE_SCHEMA,
                        mediaResolution: 'MEDIA_RESOLUTION_LOW',
                        httpOptions: { timeout: 300000 }
                    };
                    // Inject search findings + video back into a fresh request
                    const searchFindings = fullText.substring(0, 10000);
                    const jsonContents = [{ role: 'user', parts: videoUrl
                        ? [{ fileData: { fileUri: videoUrl } }, { text: jsonPromptText + (searchFindings ? '\n\nSEARCH FINDINGS:\n' + searchFindings : '') }]
                        : [{ text: jsonPromptText + (searchFindings ? '\n\nSEARCH FINDINGS:\n' + searchFindings : '') }]
                    }];
                    const jsonResponse = await ai.models.generateContent({
                        model: model || 'gemini-2.5-flash',
                        contents: jsonContents,
                        config: jsonConfig
                    });
                    accumulateUsage(jsonResponse.usageMetadata);
                    streamUsage = jsonResponse.usageMetadata || streamUsage;
                    if (typeof jsonResponse.text === 'string') fullText = jsonResponse.text;
                    else if (jsonResponse.candidates?.[0]?.content?.parts) {
                        fullText = jsonResponse.candidates[0].content.parts
                                .map(p => (p && typeof p === 'object' && p.text != null) ? String(p.text) : '').join('');
                    }
                    fullText = fullText || '';
                }
            } else {
                // NO tools: fast streaming with responseSchema
                const stdConfig = {
                    systemInstruction: enhancedSystemInstruction,
                    temperature: 0.7,
                    maxOutputTokens: 63536,
                    responseMimeType: 'application/json',
                    responseSchema: VIDEO_RESPONSE_SCHEMA,
                    mediaResolution: 'MEDIA_RESOLUTION_LOW',
                    abortSignal: abortController.signal,
                    httpOptions: { timeout: 300000 }
                };
                const stream = await ai.models.generateContentStream({
                    model: model || 'gemini-2.5-flash',
                    contents,
                    config: stdConfig
                });
                for await (const chunk of stream) {
                    if (chunk.functionCalls && chunk.functionCalls.length > 0) {
                        functionCallCount += chunk.functionCalls.length;
                        sendSSE('progress', { status: getProgressMsg(lang, 'googleSearch', functionCallCount) });
                        continue;
                    }
                    const chunkText = chunk.text || '';
                    if (chunkText) {
                        fullText += chunkText;
                        chunkCount++;
                        if (chunkCount % 5 === 0) {
                            sendSSE('progress', { status: getProgressMsg(lang, 'analyzing', Math.round(fullText.length / 1024)) });
                        }
                    }
                    if (chunk.usageMetadata) {
                        accumulateUsage(chunk.usageMetadata);
                        streamUsage = chunk.usageMetadata;
                    }
                }
                // Retry with non-streaming if validation fails
                const stdValidation = validateJsonResponse(fullText, serviceType || 'video');
                if (!stdValidation.valid && (stdValidation.code === 'AI_JSON_PARSE_ERROR' || stdValidation.code === 'AI_INCOMPLETE_RESPONSE')) {
                    sendSSE('progress', { status: getProgressMsg(lang, 'retry') });
                    const nonStreamResponse = await ai.models.generateContent({
                        model: model || 'gemini-2.5-flash',
                        contents,
                        config: stdConfig
                    });
                    accumulateUsage(nonStreamResponse.usageMetadata);
                    streamUsage = nonStreamResponse.usageMetadata || streamUsage;
                    fullText = '';
                    if (typeof nonStreamResponse.text === 'string') fullText = nonStreamResponse.text;
                    else if (typeof nonStreamResponse.text === 'function') { try { fullText = nonStreamResponse.text(); } catch (_) { } }
                    else if (nonStreamResponse.text != null && typeof nonStreamResponse.text.then === 'function') { try { fullText = await nonStreamResponse.text; } catch (_) { } }
                    if (!fullText && nonStreamResponse.candidates?.[0]?.content?.parts) {
                        fullText = nonStreamResponse.candidates[0].content.parts
                            .map(p => (p && typeof p === 'object' && p.text != null) ? String(p.text) : '').join('');
                    }
                    fullText = fullText || '';
                }
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
        const validation = validateJsonResponse(fullText, serviceType || 'video');
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

        // ── Calculate cost ────────────────────────────────────────────────────
        const promptTokens = usage.promptTokenCount || 0;
        const candidatesTokens = usage.candidatesTokenCount || 0;

        let finalPoints;
        if (isFixedPrice) {
            finalPoints = getFixedPrice(serviceType);
        } else {
            finalPoints = calculateVideoCostInPoints(promptTokens, candidatesTokens, isDeepMode, isBatch, model);
        }

        const balanceNow = await getUserPoints(userId);
        if (balanceNow < finalPoints) {
            sendSSE('error', { error: 'Insufficient points.', code: 'INSUFFICIENT_POINTS', currentBalance: balanceNow });
            endStream();
            return;
        }

        const textToSend = validation.parsed ? JSON.stringify(validation.parsed) : fullText;
        const description = serviceType === 'linkArticle' ? 'Анализ на статия (Линк)' : serviceType === 'text' ? 'Текстов анализ' : isDeepMode ? 'Дълбок видео анализ' : 'Стандартен видео анализ';
        const metadata = req.body.metadata || {};
        if (serviceType === 'video' || !serviceType) {
            metadata.videoTitle = metadata.title || metadata.videoTitle;
            metadata.videoAuthor = metadata.author || metadata.videoAuthor;
            metadata.videoId = metadata.videoId;
            metadata.videoDuration = metadata.duration;
            metadata.thumbnailUrl = metadata.thumbnailUrl;
        }

        const deductResult = await deductPointsFromUser(userId, finalPoints, description, metadata);
        if (!deductResult.success) {
            sendSSE('error', { error: 'Insufficient points.', code: 'INSUFFICIENT_POINTS', currentBalance: deductResult.newBalance });
            endStream();
            return;
        }
        const newBalance = deductResult.newBalance;
        logActivity(userId, 'analysis_video', { points: finalPoints, isDeep: isDeepMode }).catch(() => { });

        sendSSE('progress', { status: getProgressMsg(lang, 'finalizing') });
        try {
            sendSSE('complete', {
                text: textToSend,
                usageMetadata: usage,
                points: { deducted: finalPoints, costInPoints: finalPoints, newBalance, isDeep: isDeepMode }
            });
        } catch (e) {
            console.error('[Gemini Stream] Send failed after deduct:', e?.message);
            endStream();
            return;
        }

        // ── Log Real Token Costs to Server Console ────────────────────────────
        try {
            // Gemini 1.5 / 2.5 Flash Pricing Tiers
            // Media (Video/Audio) is converted to tokens (Video: ~263 tokens/sec, Audio: 32 tokens/sec)
            // and included in the promptTokenCount.
            const isOver128k = promptTokens > 128000;
            const inputRate = isOver128k ? 0.15 : 0.075;
            const outputRate = isOver128k ? 0.60 : 0.30;

            const promptCostUsd = (promptTokens / 1000000) * inputRate;
            const candidatesCostUsd = (candidatesTokens / 1000000) * outputRate;
            const totalCostUsd = promptCostUsd + candidatesCostUsd;

            console.log('\n=========================================');
            console.log(`🧠 [DEEP ANALYSIS] API USAGE REPORT`);
            console.log(`=========================================`);
            console.log(`► Type: ${isDeepMode ? 'Deep' : 'Standard'} Analysis`);
            console.log(`► Prompt Tokens: ${promptTokens.toLocaleString()} (${promptCostUsd.toFixed(6)} USD)`);
            console.log(`► Output Tokens: ${candidatesTokens.toLocaleString()} (${candidatesCostUsd.toFixed(6)} USD)`);
            console.log(`► Total Tokens: ${(promptTokens + candidatesTokens).toLocaleString()}`);
            console.log(`► Estimated Real Cost: $${totalCostUsd.toFixed(6)} USD`);
            console.log(`► Points Deducted: ${finalPoints} pts`);
            console.log(`=========================================\n`);
        } catch (e) {
            console.log('[Cost Logger Error]', e.message);
        }

        sendSSE('points_deducted', { newBalance });
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

export { validateJsonResponse };
export default router;
