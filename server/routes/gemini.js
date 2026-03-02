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
import {
    calculateVideoCostInPoints,
    getFixedPrice
} from '../config/pricing.js';
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
    } catch (_) {}
    try {
        return { ok: true, parsed: JSON.parse(escapeControlCharsInJson(t)) };
    } catch (_) {}
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
// Helper: get Gemini AI instance
// ─────────────────────────────────────────────────────────────────────────────
function getAI() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY;
    if (!apiKey) throw new Error('Server configuration error: Missing API key');
    return new GoogleGenAI({ apiKey });
}

// JSON Schema for structured output — relaxed so Gemini always returns valid JSON (video & link)
const VIDEO_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        summary: { type: 'string' },
        overallAssessment: { type: 'string' },
        detailedMetrics: { type: 'object' },
        factualClaims: { type: 'array', items: { type: 'object' } },
        claims: { type: 'array', items: { type: 'object' } },
        quotes: { type: 'array', items: { type: 'object' } },
        manipulationTechniques: { type: 'array', items: { type: 'object' } },
        finalInvestigativeReport: { type: 'string' },
        transcription: { type: 'array', items: { type: 'object' } },
        geopoliticalContext: { type: 'array', items: { type: 'object' } },
        historicalParallel: { type: 'array', items: { type: 'object' } },
        psychoLinguisticAnalysis: { type: 'array', items: { type: 'object' } },
        strategicIntent: { type: 'array', items: { type: 'object' } },
        narrativeArchitecture: { type: 'array', items: { type: 'object' } },
        technicalForensics: { type: 'array', items: { type: 'object' } },
        socialImpactPrediction: { type: 'array', items: { type: 'object' } },
        visualAnalysis: { type: 'array', items: { type: 'object' } },
        bodyLanguageAnalysis: { type: 'array', items: { type: 'object' } },
        vocalAnalysis: { type: 'array', items: { type: 'object' } },
        deceptionAnalysis: { type: 'array', items: { type: 'object' } },
        humorAnalysis: { type: 'array', items: { type: 'object' } },
        psychologicalProfile: { type: 'array', items: { type: 'object' } },
        culturalSymbolicAnalysis: { type: 'array', items: { type: 'object' } },
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
        const hasSummary = typeof parsed.summary === 'string' && parsed.summary.length > 0;
        const hasContent = (Array.isArray(parsed.factualClaims) && parsed.factualClaims.length > 0) ||
            (Array.isArray(parsed.claims) && parsed.claims.length > 0) ||
            (Array.isArray(parsed.quotes) && parsed.quotes.length > 0) ||
            (Array.isArray(parsed.manipulationTechniques) && parsed.manipulationTechniques.length > 0) ||
            parsed.overallAssessment ||
            (parsed.detailedMetrics && typeof parsed.detailedMetrics === 'object');
        if (hasSummary && (hasContent || parsed.overallAssessment || parsed.finalInvestigativeReport)) {
            return { valid: true, parsed, cleanedText: JSON.stringify(parsed) };
        }
        if (hasSummary || hasContent) {
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
        const { model, prompt, systemInstruction, videoUrl, isBatch, enableGoogleSearch, mode, serviceType, lang } = req.body;

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

        // ── Build request ─────────────────────────────────────────────────────
        let tools;
        if (serviceType === 'linkArticle') {
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
                    if (chunk.usageMetadata) usage = chunk.usageMetadata;
                }
            } else {
                const jsonRuleShort = 'CRITICAL: Respond with exactly one valid JSON object. Start with {, end with }. No markdown. Escape " in strings as \\". Never truncate.';
                const sysInstr = (systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON.') + '\n\n' + getLanguageInstruction(lang) + '\n\n' + jsonRuleShort;
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

            // If this was the last attempt, don't retry
            if (attempt >= maxRetries) {
                break;
            }
        }

        if (!lastValidation.valid) {
            return res.status(500).json({
                error: 'AI генерира непълен отговор. Моля, опитайте отново.',
                code: lastValidation.code
            });
        }

        // ── Calculate cost ────────────────────────────────────────────────────
        const promptTokens = usage?.promptTokenCount || 0;
        const candidatesTokens = usage?.candidatesTokenCount || 0;

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

    // Heartbeat every 15s — Cloud Run / load balancers often close after 5 min idle
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 15000);

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
            return res.end();
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
            'Never truncate: always output the full JSON and close every bracket.'
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

        if (isDeepMode && tools) {
            // DEEP MODE: Use generateContent. When model returns only a tool/function call (no text),
            // we must send that back with a function response and call again until we get text.
            sendSSE('progress', { status: getProgressMsg(lang, 'deepPreparing') });

            // Tool use + responseMimeType JSON is unsupported by Gemini — omit both for deep
            const config = {
                systemInstruction: enhancedSystemInstruction,
                temperature: 0.7,
                maxOutputTokens: 63536,
                mediaResolution: 'MEDIA_RESOLUTION_LOW',
                tools
            };
            let currentContents = [...contents];
            const maxRounds = 5;
            let response = null;

            for (let round = 0; round < maxRounds; round++) {
                response = await ai.models.generateContent({
                    model: model || 'gemini-2.5-flash',
                    contents: currentContents,
                    config
                });
                streamUsage = response.usageMetadata || streamUsage;

                fullText = '';
                if (typeof response.text === 'string') fullText = response.text;
                else if (typeof response.text === 'function') { try { fullText = response.text(); } catch (_) { } }
                else if (response.text != null && typeof response.text.then === 'function') { try { fullText = await response.text; } catch (_) { } }
                if (!fullText && response.candidates?.[0]?.content?.parts) {
                    fullText = response.candidates[0].content.parts
                        .map(p => (p && typeof p === 'object' && p.text != null) ? String(p.text) : '')
                        .join('');
                }
                fullText = fullText || '';

                if (fullText.length) break;

                const parts = response.candidates?.[0]?.content?.parts;
                const hasFn = Array.isArray(parts) && parts.some(p => p?.functionCall || p?.function_call);
                if (!hasFn || !parts?.length) {
                    if (round === 0) {
                        sendSSE('progress', { status: getProgressMsg(lang, 'retry') });
                        await new Promise(r => setTimeout(r, 1500));
                        continue;
                    }
                    if (fullText.length === 0) console.error('[Gemini Stream] Deep: празен отговор след повторен опит.');
                    break;
                }

                sendSSE('progress', { status: getProgressMsg(lang, 'googleRound', round + 1) });
                const fnResponseParts = parts
                    .filter(p => p?.functionCall || p?.function_call)
                    .map(p => {
                        const fc = p.functionCall || p.function_call;
                        return { functionResponse: { name: fc.name, response: fc.args || {} } };
                    });
                currentContents = [
                    ...currentContents,
                    { role: 'model', parts },
                    { role: 'user', parts: fnResponseParts }
                ];
            }

            // If we only got function calls and no text, ask once more for JSON only (no tools — allows responseMimeType)
            if (!fullText.length && response?.candidates?.[0]?.content?.parts?.length) {
                sendSSE('progress', { status: getProgressMsg(lang, 'finalJson') });
                const jsonOnlyPrompt = { role: 'user', parts: [{ text: 'Return the full analysis as a single valid JSON object. No other text. Start with { and end with }.' }] };
                const finalConfig = { ...config, tools: undefined, responseMimeType: 'application/json', responseSchema: VIDEO_RESPONSE_SCHEMA };
                const finalResponse = await ai.models.generateContent({
                    model: model || 'gemini-2.5-flash',
                    contents: [...currentContents, jsonOnlyPrompt],
                    config: finalConfig
                });
                streamUsage = finalResponse.usageMetadata || streamUsage;
                if (typeof finalResponse.text === 'string') fullText = finalResponse.text;
                else if (typeof finalResponse.text === 'function') { try { fullText = finalResponse.text(); } catch (_) { } }
                else if (finalResponse.text != null && typeof finalResponse.text.then === 'function') { try { fullText = await finalResponse.text; } catch (_) { } }
                if (!fullText && finalResponse.candidates?.[0]?.content?.parts) {
                    fullText = finalResponse.candidates[0].content.parts
                        .map(p => (p && typeof p === 'object' && p.text != null) ? String(p.text) : '')
                        .join('');
                }
                fullText = fullText || '';
            }

            // Simulate streaming the result back to the UI so it doesn't look frozen
            const chunkSize = 2000;
            for (let i = 0; i < fullText.length; i += chunkSize) {
                sendSSE('progress', { status: getProgressMsg(lang, 'synthesizing', Math.round(i / 1024)) });
                await new Promise(r => setTimeout(r, 50)); // tiny delay
            }

        } else {
            // STANDARD MODE: Safe to use true streaming
            const stream = await ai.models.generateContentStream({
                model: model || 'gemini-2.5-flash',
                contents,
                config: {
                    systemInstruction: enhancedSystemInstruction,
                    temperature: 0.7,
                    maxOutputTokens: 63536,
                    responseMimeType: 'application/json',
                    responseSchema: VIDEO_RESPONSE_SCHEMA,
                    mediaResolution: 'MEDIA_RESOLUTION_LOW'
                }
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
                if (chunk.usageMetadata) streamUsage = chunk.usageMetadata;
            }
        }

        clearInterval(heartbeat);

        const usage = streamUsage || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

        // ── Validate response ─────────────────────────────────────────────────
        const validation = validateJsonResponse(fullText, serviceType || 'video');
        if (!validation.valid) {
            console.error(`[Gemini Stream] Validation failed: ${validation.code}`, validation.error || '', `(${fullText.length} chars)`);

            if (fullText.length > 0) {
                try {
                    const fs = await import('fs');
                    fs.writeFileSync(`failed_gemini_stream.txt`, fullText);
                    console.log('Saved failed JSON to failed_gemini_stream.txt for debugging.');
                } catch (err) {
                    console.error('Failed to write debug file', err);
                }
            }

            const emptyMsg = validation.code === 'AI_EMPTY_RESPONSE'
                ? 'Моделът не върна съдържание. Опитайте отново след минута или изберете по-кратко видео.'
                : 'AI върна невалиден формат. Никакви точки не бяха таксувани.';
            try {
                sendSSE('error', { error: emptyMsg, code: validation.code, details: validation.error || 'Unknown validation error' });
            } catch (sendErr) {
                console.error('[Gemini Stream] Send error event failed:', sendErr?.message);
            }
            try { res.end(); } catch (_) {}
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
            return res.end();
        }

        const textToSend = validation.parsed ? JSON.stringify(validation.parsed) : fullText;
        sendSSE('progress', { status: getProgressMsg(lang, 'finalizing') });

        try {
            sendSSE('complete', {
                text: textToSend,
                usageMetadata: usage,
                points: { deducted: finalPoints, costInPoints: finalPoints, pending: true, isDeep: isDeepMode }
            });
        } catch (e) {
            console.error('[Gemini Stream] Send failed, no charge:', e?.message);
            return res.end();
        }

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
        const newBalance = deductResult.newBalance ?? balanceNow - finalPoints;

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
        res.end();

    } catch (error) {
        clearInterval(heartbeat);
        console.error('[Gemini Stream API] Error:', error?.message || error);
        try {
            sendSSE('error', { error: error.message || 'Failed to generate content', code: 'UNKNOWN_ERROR' });
        } catch (writeErr) {
            console.error('[Gemini Stream API] Could not send error SSE:', writeErr.message);
        }
        res.end();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gemini/synthesize-report — Report synthesis (no billing)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/synthesize-report', requireAuth, async (req, res) => {
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
