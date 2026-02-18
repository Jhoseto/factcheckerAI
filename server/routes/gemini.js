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
} from '../../services/firebaseAdmin.js';
import {
    calculateVideoCostInPoints,
    getFixedPrice,
    logBilling
} from '../config/pricing.js';

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
    return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gemini/generate — Standard (non-video) generation
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate', requireAuth, analysisRateLimiter, async (req, res) => {
    req.setTimeout(900000);
    res.setTimeout(900000);

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

        // ── Generate ──────────────────────────────────────────────────────────
        let responseText = '';
        let usage = null;

        if (videoUrl) {
            const stream = await ai.models.generateContentStream({
                model: model || 'gemini-2.5-flash',
                contents,
                config: {
                    systemInstruction: systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON.',
                    temperature: 0.7,
                    maxOutputTokens: isDeepMode ? 65536 : 20000,
                    responseMimeType: tools ? undefined : 'application/json',
                    mediaResolution: 'MEDIA_RESOLUTION_LOW',
                    tools
                }
            });
            for await (const chunk of stream) {
                if (chunk.text) responseText += chunk.text;
                if (chunk.usageMetadata) usage = chunk.usageMetadata;
            }
        } else {
            const response = await ai.models.generateContent({
                model: model || 'gemini-2.5-flash',
                contents,
                config: {
                    systemInstruction: systemInstruction || 'You are a professional fact-checker. Respond ONLY with valid JSON.',
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
        const validation = validateJsonResponse(responseText);
        if (!validation.valid) {
            return res.status(500).json({
                error: 'AI върна невалиден формат. Никакви точки не бяха таксувани.',
                code: validation.code
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
        const deductResult = await deductPointsFromUser(userId, finalPoints);
        if (!deductResult.success) {
            return res.status(403).json({
                error: 'Insufficient points after generation.',
                code: 'INSUFFICIENT_POINTS',
                currentBalance: deductResult.newBalance
            });
        }

        // ── Return result ─────────────────────────────────────────────────────
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
        const deductResult = await deductPointsFromUser(userId, finalPoints);
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
