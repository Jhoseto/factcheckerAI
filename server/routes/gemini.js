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
    getFixedPrice,
    logBilling
} from '../config/pricing.js';
import { safeJsonParse } from '../utils/safeJson.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get Gemini AI instance
// ─────────────────────────────────────────────────────────────────────────────
function getAI() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY;
    if (!apiKey) throw new Error('Server configuration error: Missing API key');
    return new GoogleGenAI({ apiKey });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: validate and clean JSON response
// ─────────────────────────────────────────────────────────────────────────────
function validateJsonResponse(responseText) {
    if (!responseText || responseText.length < 10) {
        return { valid: false, code: 'AI_EMPTY_RESPONSE' };
    }
    let trimmed = responseText.trim();
    const jsonMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) trimmed = jsonMatch[1].trim();
    else {
        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            trimmed = trimmed.substring(firstBrace, lastBrace + 1);
        }
    }
    if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
        if (!trimmed.includes('{') && !trimmed.includes('[')) {
            return { valid: false, code: 'AI_INVALID_FORMAT' };
        }
    }

    // Additional validation: Check if JSON is complete and valid
    try {
        // Use safeJsonParse to attempt repair of truncated/malformed JSON
        const parsed = safeJsonParse(trimmed);

        // Check if it's an object (not array) and has required fields for analysis
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            // For link/article analysis, check for critical fields
            const hasTitle = parsed.title && parsed.title.length > 5;
            const hasSiteName = parsed.siteName && parsed.siteName.length > 0;
            const hasSummary = parsed.summary && parsed.summary.length > 20;
            const hasOverallAssessment = parsed.overallAssessment;
            const hasDetailedMetrics = parsed.detailedMetrics && typeof parsed.detailedMetrics === 'object';

            // Check if the response looks complete (has at least some key fields)
            const hasMinRequiredFields = hasTitle && hasSiteName && hasSummary;

            // Check for truncated content indicators (summary ending abruptly)
            let isTruncated = false;
            if (parsed.summary) {
                // Check if summary ends with incomplete sentence or gets cut off
                const summary = parsed.summary;
                // Check for incomplete endings - more comprehensive check
                if (summary.endsWith('...') ||
                    summary.endsWith(',') ||
                    summary.endsWith(' ')) {
                    isTruncated = true;
                }
            }

            // Check if we have at least the core analysis fields
            const hasAnalysisData = hasOverallAssessment && hasDetailedMetrics;

            // CRITICAL: Must have analysis data, not just basic metadata
            if (!hasMinRequiredFields || isTruncated || !hasAnalysisData) {
                return { valid: false, code: 'AI_INCOMPLETE_RESPONSE', parsed };
            }
        }

        return { valid: true, parsed };
    } catch (e) {
        return { valid: false, code: 'AI_JSON_PARSE_ERROR', error: e.message };
    }
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
        const { model, prompt, systemInstruction, videoUrl, isBatch, enableGoogleSearch, mode, serviceType } = req.body;

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
        const tools = (isDeepMode || enableGoogleSearch) ? [{ googleSearch: {} }] : undefined;
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
        // Reduce max retries to avoid long waits (7+ mins). 
        // We rely on safeJsonParse to fix minor truncations.
        const maxRetries = 1;
        let lastValidation = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (videoUrl) {
                const stream = await ai.models.generateContentStream({
                    model: model || 'gemini-2.5-flash',
                    contents,
                    config: {
                        systemInstruction: systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON. Complete ALL fields in the response.',
                        temperature: 0.7,
                        maxOutputTokens: isDeepMode ? 65536 : 20000,
                        responseMimeType: tools ? undefined : 'application/json',
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
                // Add instruction to complete the response on retry attempts
                const retryInstruction = attempt > 0 ? ". ВНИМАНИЕ: Предишният отговор беше непълен или невалиден JSON. Уверете се, че затваряте всички скоби и кавички. Попълнете всички полета." : "";

                const enrichedContents = [...contents];
                if (retryInstruction && attempt > 0) {
                    // Add retry instruction to the last user message
                    const lastUserMsg = enrichedContents[enrichedContents.length - 1];
                    // Clone deep to avoid mutating original for next retry
                    const msgClone = JSON.parse(JSON.stringify(lastUserMsg));
                    if (msgClone.role === 'user') {
                        msgClone.parts[0].text += retryInstruction;
                    }
                    enrichedContents[enrichedContents.length - 1] = msgClone;
                }

                const response = await ai.models.generateContent({
                    model: model || 'gemini-2.5-flash',
                    contents: enrichedContents,
                    config: {
                        systemInstruction: systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON. Complete ALL fields in the response. Do not truncate!',
                        temperature: 0.7,
                        maxOutputTokens: isDeepMode ? 65536 : 20000,
                        responseMimeType: tools ? undefined : 'application/json',
                        tools
                    }
                });
                responseText = response.text || '';
                usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };
            }

            // ── Validate response ─────────────────────────────────────────────────
            lastValidation = validateJsonResponse(responseText);
            if (lastValidation.valid) {
                break; // Success, exit retry loop
            }

            console.log(`[Gemini] Attempt ${attempt + 1} failed validation: ${lastValidation.code}. Retrying...`);

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

        logBilling(
            'generate',
            promptTokens,
            candidatesTokens,
            (promptTokens / 1e6) * 0.50 + (candidatesTokens / 1e6) * 2.00,
            ((promptTokens / 1e6) * 0.50 + (candidatesTokens / 1e6) * 2.00) * 0.95,
            finalPoints,
            isDeepMode
        );

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

            console.log(`[Gemini API] 🟢 Initiating deduction for user ${userId}: ${finalPoints} points ("${description}")`);
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
                text: responseText,
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

    try {
        const ai = getAI();
        const userId = req.userId;
        const { model, prompt, systemInstruction, videoUrl, isBatch, enableGoogleSearch, mode, serviceType } = req.body;

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

        sendSSE('progress', { status: 'Изпращане на заявка към AI...' });

        const stream = await ai.models.generateContentStream({
            model: model || 'gemini-2.5-flash',
            contents,
            config: {
                systemInstruction: systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON.',
                temperature: 0.7,
                maxOutputTokens: isDeepMode ? 65536 : 50000,
                responseMimeType: tools ? undefined : 'application/json',
                mediaResolution: 'MEDIA_RESOLUTION_LOW',
                tools
            }
        });

        let fullText = '';
        let streamUsage = null;
        let chunkCount = 0;

        for await (const chunk of stream) {
            const chunkText = chunk.text || '';
            if (chunkText) {
                fullText += chunkText;
                chunkCount++;
                if (chunkCount % 5 === 0) {
                    sendSSE('progress', { status: `Анализиране (${Math.round(fullText.length / 1024)} KB)...` });
                }
            }
            if (chunk.usageMetadata) streamUsage = chunk.usageMetadata;
        }

        const usage = streamUsage || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

        // ── Validate response ─────────────────────────────────────────────────
        const validation = validateJsonResponse(fullText);
        if (!validation.valid) {
            sendSSE('error', { error: 'AI върна невалиден формат. Никакви точки не бяха таксувани.', code: validation.code });
            return res.end();
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

        logBilling(
            'generate-stream',
            promptTokens,
            candidatesTokens,
            (promptTokens / 1e6) * 0.50 + (candidatesTokens / 1e6) * 2.00,
            ((promptTokens / 1e6) * 0.50 + (candidatesTokens / 1e6) * 2.00) * 0.95,
            finalPoints,
            isDeepMode
        );

        // ── Deduct points SERVER-SIDE ─────────────────────────────────────────
        sendSSE('progress', { status: 'Финализиране и таксуване...' });

        let description = 'Анализ на съдържание';
        if (serviceType === 'linkArticle') {
            description = 'Анализ на статия (Линк)';
        } else if (serviceType === 'text') {
            description = 'Текстов анализ';
        } else {
            description = isDeepMode ? 'Дълбок видео анализ' : 'Стандартен видео анализ';
        }

        const deductResult = await deductPointsFromUser(userId, finalPoints, description);
        if (!deductResult.success) {
            sendSSE('error', { error: 'Insufficient points after generation.', code: 'INSUFFICIENT_POINTS' });
            return res.end();
        }

        // ── Send complete event ───────────────────────────────────────────────
        sendSSE('complete', {
            text: fullText,
            usageMetadata: usage,
            points: {
                deducted: finalPoints,
                costInPoints: finalPoints,
                newBalance: deductResult.newBalance,
                isDeep: isDeepMode
            }
        });
        res.end();

    } catch (error) {
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
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

        console.log('[Report Synthesis] Starting text-only generation...');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { temperature: 0.8, maxOutputTokens: 16000 }
        });

        let reportText = '';
        if (typeof response.text === 'string') reportText = response.text;
        else if (typeof response.text === 'function') reportText = response.text();
        else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
            reportText = response.candidates[0].content.parts[0].text;
        }

        console.log('[Report Synthesis] Complete. Length:', reportText.length);
        res.json({ report: reportText });
    } catch (error) {
        console.error('[Report Synthesis] Error:', error?.message || error);
        res.status(500).json({ error: error.message || 'Report synthesis failed' });
    }
});

export default router;
