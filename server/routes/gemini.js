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
    estimateVideoCostInPoints,
    getFixedPrice,
    GEMINI_API_PRICING
} from '../config/pricing.js';
import { MODELS } from '../config/models.js';
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
    required: ['summary', 'claims', 'manipulations'],
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

                // Stage 1: Extraction (Flash)
                const extractionConfig = {
                    systemInstruction: (systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON.') + '\n\n' + getLanguageInstruction(lang),
                    temperature: 0.1,
                    maxOutputTokens: 65536,
                    mediaResolution: 'MEDIA_RESOLUTION_LOW',
                    tools: tools // Flash handles the initial search/extraction
                };

                const response = await ai.models.generateContent({
                    model: modelExtractor,
                    contents,
                    config: extractionConfig
                });

                const researchTokens = response.usageMetadata;
                const rawText = response.text || '';

                // Stage 2: Smart Synthesis (Pro 3.1)
                const videoContextStr = req.body.metadata?.title ? `VIDEO METADATA:\n- Title: ${req.body.metadata.title}\n\n` : '';
                const synthesisContents = [
                    ...contents,
                    { role: 'user', parts: [{ text: `${videoContextStr}ESTABLISHED RESEARCH DATA (GROUND TRUTH):\n\n${rawText}\n\nINSTRUCTION: Using the data above and MARCH 2026 as current context, synthesize the final analysis exactly according to the schema.` }] }
                ];

                const finalResponse = await ai.models.generateContent({
                    model: modelSynthesizer,
                    contents: synthesisContents,
                    config: {
                        temperature: 0.1,
                        responseMimeType: 'application/json',
                        responseSchema: serviceType === 'linkArticle' ? LINK_RESPONSE_SCHEMA : (isDeepMode ? VIDEO_DEEP_SCHEMA : VIDEO_STANDARD_SCHEMA)
                    }
                });

                responseText = finalResponse.text || '';
                const finalUsageMeta = finalResponse.usageMetadata;

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

        // Fallback for linkArticle: if tools caused empty response, retry without tools
        if (!lastValidation.valid && serviceType === 'linkArticle' && tools) {
            console.log('[LinkArticle] Fallback: retrying without googleSearch tools');
            const jsonRuleShort = 'CRITICAL: Respond with exactly one valid JSON object. Start with {, end with }. No markdown. Escape " in strings as \\". Never truncate.';
            const sysInstr = (systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON.') + '\n\n' + getLanguageInstruction(lang) + '\n\n' + jsonRuleShort;
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
            if (fallbackResponse.usageMetadata) {
                totalPromptTokens = fallbackResponse.usageMetadata.promptTokenCount || 0;
                totalCandidatesTokens = fallbackResponse.usageMetadata.candidatesTokenCount || 0;
            }
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
        const { model, prompt, systemInstruction, videoUrl, enableGoogleSearch, mode, serviceType, lang, metadata: reqMetadata } = req.body;
        const metadata = reqMetadata || {};

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

        if (isDeepMode && tools) {
            // DEEP MODE: 1) generateContent with googleSearch (Google does search on its servers)
            // 2) ALWAYS final JSON step with responseSchema — guarantees valid JSON (tools + schema incompatible)
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

            // Build conversation for final JSON step (model's analysis as context)
            let currentContents = [...contents];
            let hasGrounding = rawText && rawText.trim().length > 50;
            if (hasGrounding) {
                const videoContextStr = metadata.title ? `VIDEO METADATA (Reference Point):\n- Title: ${metadata.title}\n- Author: ${metadata.author || 'Unknown'}\n- Uploaded/Published: ${metadata.date || 'Refer to content'}\n\n` : '';
                // Pass research as established ground truth
                currentContents.push({
                    role: 'user',
                    parts: [{ text: `${videoContextStr}ESTABLISHED RESEARCH DATA (ABSOLUTE GROUND TRUTH):\n\n${rawText.substring(0, 60000)}\n\nINSTRUCTION: You MUST use the research data above as the primary source for all "explanation" and "missingContext" fields. This data represents the current reality and OVERRIDES any conflicting pre-trained knowledge. Do not use placeholders. Every claim MUST be evaluated against these findings. If a claim involves timing (e.g. "today"), use this data and current date clues to determine the actual context.` }]
                });
            }

            const jsonPromptsWithContext = [
                'Return the complete analysis as JSON using the exact schema. INTEGRATE your research into the "explanation" and "logic" fields. BE EXTREMELY LOGICAL AND DETAILED. Do not use generic statements. Populate EVERY array. Keep finalInvestigativeReport concise. Ensure valid JSON. Never leave arrays empty.',
                'Perform an EXHAUSTIVE video analysis based on your research and format as valid JSON. Populate all fields with high-quality evidence. No placeholders.'
            ];
            const jsonPromptsNoContext = [
                'Analyze the VIDEO and return complete fact-check analysis as JSON. Populate EVERY array (visualAnalysis, bodyLanguageAnalysis, etc). Be extremely concise to avoid JSON truncation.',
                'Format as valid JSON. Analyze the video for all behavioral metrics. No placeholders. Generate 1-2 items per array.'
            ];
            const jsonPrompts = hasGrounding ? jsonPromptsWithContext : jsonPromptsNoContext;
            const finalConfig = {
                systemInstruction: enhancedSystemInstruction,
                tools: undefined,
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

            const videoContextStr = metadata.title ? `VIDEO METADATA:\n- Title: ${metadata.title}\n\n` : '';
            const textContents = contents.map(c => ({
                role: c.role,
                parts: c.parts.filter(p => !p.fileData && !p.inlineData)
            }));
            const synthesisContents = [
                ...textContents,
                { role: 'user', parts: [{ text: `${videoContextStr}ESTABLISHED RESEARCH DATA (ABSOLUTE GROUND TRUTH):\n\n${rawText}\n\nINSTRUCTION: Using the findings above, synthesize the final JSON analysis according to the schema. Ensure high reliability and temporal accuracy relative to March 2026.` }] }
            ];

            const finalConfig = {
                systemInstruction: enhancedSystemInstruction,
                temperature: 0.1,
                maxOutputTokens: 65536,
                responseMimeType: 'application/json',
                responseSchema: VIDEO_STANDARD_SCHEMA,
                thinkingConfig: { thinkingBudget: 4000 },
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
            const billingData = [];
            if (researchUsage) {
                billingData.push({
                    model: MODELS.VIDEO_EXTRACTOR,
                    promptTokens: researchUsage.promptTokenCount,
                    candidatesTokens: researchUsage.candidatesTokenCount
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

        const textToSend = validation.parsed ? JSON.stringify(validation.parsed) : fullText;
        const description = serviceType === 'linkArticle' ? 'Анализ на статия (Линк)' : serviceType === 'text' ? 'Текстов анализ' : isDeepMode ? 'Дълбок видео анализ' : 'Стандартен видео анализ';
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
            // Gemini 1.5 / 2.5 Flash Pricing
            // Media (Video/Audio) is included in promptTokenCount.
            let promptCostUsd = 0;
            let candidatesCostUsd = 0;

            const billingData = [];
            if (researchUsage) {
                billingData.push({ model: MODELS.VIDEO_EXTRACTOR, promptTokens: researchUsage.promptTokenCount, candidatesTokens: researchUsage.candidatesTokenCount });
            }
            if (finalUsage) {
                billingData.push({ model: MODELS.REPORT_SYNTHESIZER, promptTokens: finalUsage.promptTokenCount, candidatesTokens: finalUsage.candidatesTokenCount });
            }

            for (const item of billingData) {
                const p = GEMINI_API_PRICING[item.model];
                const pTier = item.promptTokens > 128000 ? 2 : 1;
                promptCostUsd += (item.promptTokens / 1000000) * p.inputPerMillion * pTier;
                candidatesCostUsd += (item.candidatesTokens / 1000000) * p.outputPerMillion * pTier;
            }
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
