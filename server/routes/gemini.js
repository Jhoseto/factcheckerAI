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
// Enhanced for Deep mode with Google Search tools
// ─────────────────────────────────────────────────────────────────────────────
function validateJsonResponse(responseText, serviceType = 'link') {
    if (!responseText || responseText.length < 10) {
        return { valid: false, code: 'AI_EMPTY_RESPONSE' };
    }
    
    let trimmed = responseText.trim();
    
    // Step 1: Remove function call artifacts (Google Search tool responses)
    // Function calls look like: "function_call" or "tool_calls" sections
    // Remove any text before the first JSON object that looks like function call output
    trimmed = trimmed.replace(/```json\s*/g, '').replace(/\s*```/g, '');
    
    // Step 2: Try to extract JSON from markdown code blocks first
    const jsonBlockMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
        trimmed = jsonBlockMatch[1].trim();
    } else {
        // Step 3: Find the largest JSON object in the text
        // This handles cases where there's text before/after JSON
        const jsonStart = trimmed.search(/[{\[]/);
        if (jsonStart !== -1) {
            const startChar = trimmed[jsonStart];
            const endChar = startChar === '{' ? '}' : ']';
            let depth = 0;
            let jsonEnd = -1;
            let inString = false;
            let escapeNext = false;
            
            // Properly track depth considering strings (which can contain { } [ ])
            for (let i = jsonStart; i < trimmed.length; i++) {
                const char = trimmed[i];
                
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                
                if (char === '\\') {
                    escapeNext = true;
                    continue;
                }
                
                if (char === '"' && !escapeNext) {
                    inString = !inString;
                    continue;
                }
                
                if (!inString) {
                    if (char === startChar) depth++;
                    else if (char === endChar) {
                        depth--;
                        if (depth === 0) {
                            jsonEnd = i;
                            break;
                        }
                    }
                }
            }
            
            if (jsonEnd !== -1) {
                trimmed = trimmed.substring(jsonStart, jsonEnd + 1);
            } else {
                // Fallback: use last brace/bracket
                const lastBrace = trimmed.lastIndexOf('}');
                const lastBracket = trimmed.lastIndexOf(']');
                const lastEnd = Math.max(lastBrace, lastBracket);
                if (lastEnd > jsonStart) {
                    trimmed = trimmed.substring(jsonStart, lastEnd + 1);
                }
            }
        }
    }
    
    // Step 4: Clean up common JSON issues
    // Remove trailing commas
    trimmed = trimmed.replace(/,(\s*[}\]])/g, '$1');
    
    // Remove single-line comments (be careful with URLs)
    trimmed = trimmed.replace(/([^:])\/\/[^\n]*/g, '$1');
    
    // Remove multi-line comments
    trimmed = trimmed.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Step 5: Sanitize control characters and fix string escaping
    let sanitized = '';
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        const code = trimmed.charCodeAt(i);
        
        // Handle escape sequences
        if (inString && ch === '\\') {
            sanitized += ch;
            i++;
            if (i < trimmed.length) {
                sanitized += trimmed[i];
            }
            continue;
        }
        
        // Handle quotes
        if (ch === '"') {
            if (!inString) {
                inString = true;
                sanitized += ch;
            } else {
                // Check if this is a closing quote or internal quote
                let lookAhead = i + 1;
                while (lookAhead < trimmed.length && /\s/.test(trimmed[lookAhead])) {
                    lookAhead++;
                }
                const nextChar = lookAhead < trimmed.length ? trimmed[lookAhead] : '';
                
                if (nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === '') {
                    inString = false;
                    sanitized += ch;
                } else {
                    // Internal quote - escape it
                    sanitized += '\\"';
                }
            }
            continue;
        }
        
        // Handle control characters in strings
        if (inString && code < 0x20) {
            switch (code) {
                case 0x0A: sanitized += '\\n'; break;
                case 0x0D: sanitized += '\\r'; break;
                case 0x09: sanitized += '\\t'; break;
                case 0x08: sanitized += '\\b'; break;
                case 0x0C: sanitized += '\\f'; break;
                default: sanitized += '\\u' + code.toString(16).padStart(4, '0'); break;
            }
            continue;
        }
        
        sanitized += ch;
    }
    
    trimmed = sanitized.trim();
    
    // Step 6: Try to parse
    try {
        const parsed = safeJsonParse(trimmed);

        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            // Video analysis - flexible validation (title optional; client has videoMetadata)
            if (serviceType === 'video') {
                const hasSummary = parsed.summary && typeof parsed.summary === 'string' && parsed.summary.length > 10;
                const hasContent = (Array.isArray(parsed.factualClaims) && parsed.factualClaims.length > 0) ||
                    (Array.isArray(parsed.claims) && parsed.claims.length > 0) ||
                    (Array.isArray(parsed.quotes) && parsed.quotes.length > 0) ||
                    (Array.isArray(parsed.manipulationTechniques) && parsed.manipulationTechniques.length > 0) ||
                    (parsed.overallAssessment && parsed.detailedMetrics);
                const hasMinFields = hasSummary && (hasContent || parsed.overallAssessment);
                if (!hasMinFields) {
                    console.log('[validateJsonResponse] Video response missing required fields. Keys:', Object.keys(parsed));
                    return { valid: false, code: 'AI_INCOMPLETE_RESPONSE', parsed };
                }
                return { valid: true, parsed };
            }

            // Link/Article analysis - stricter validation
            const hasTitle = parsed.title && parsed.title.length > 5;
            const hasSiteName = parsed.siteName && parsed.siteName.length > 0;
            const hasSummary = parsed.summary && parsed.summary.length > 20;

            if (!hasTitle || !hasSiteName || !hasSummary) {
                return { valid: false, code: 'AI_INCOMPLETE_RESPONSE', parsed };
            }
        }

        return { valid: true, parsed };
    } catch (e) {
        console.error('[validateJsonResponse] JSON parse failed:', e.message);
        console.error('[validateJsonResponse] First 500 chars of cleaned text:', trimmed.substring(0, 500));
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
            lastValidation = validateJsonResponse(responseText, serviceType || 'video');
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

    // Heartbeat to prevent 5-min proxy timeouts (Cloudflare/Nginx)
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

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

        // Enhanced system instruction for Deep mode with tools
        let enhancedSystemInstruction = systemInstruction;
        if (isDeepMode && tools) {
            enhancedSystemInstruction = (systemInstruction || '') + 
                '\n\nCRITICAL: After using Google Search tools, you MUST respond with a complete, valid JSON object. ' +
                'Do not include any text before or after the JSON. The JSON must start with { and end with }. ' +
                'All tool results should be integrated into the JSON response, not returned separately.';
        } else if (!systemInstruction) {
            enhancedSystemInstruction = 'You are a professional fact-checker. Respond ONLY with valid JSON.';
        }
        
        const stream = await ai.models.generateContentStream({
            model: model || 'gemini-2.5-flash',
            contents,
            config: {
                systemInstruction: enhancedSystemInstruction,
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
        let functionCallCount = 0;

        for await (const chunk of stream) {
            // Handle function calls (Google Search tool invocations)
            if (chunk.functionCalls && chunk.functionCalls.length > 0) {
                functionCallCount += chunk.functionCalls.length;
                sendSSE('progress', { status: `Търсене в Google (${functionCallCount} заявки)...` });
                // Function calls are handled automatically by Gemini, we just track them
                continue;
            }
            
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
        
        // Log if we had function calls (for debugging)
        if (functionCallCount > 0) {
            console.log(`[Gemini Stream] Processed ${functionCallCount} function calls (Google Search)`);
        }

        clearInterval(heartbeat);

        const usage = streamUsage || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

        // ── Validate response ─────────────────────────────────────────────────
        console.log(`[Gemini Stream] Response length: ${fullText.length} chars`);
        console.log(`[Gemini Stream] First 200 chars: ${fullText.substring(0, 200)}`);
        console.log(`[Gemini Stream] Last 200 chars: ${fullText.substring(Math.max(0, fullText.length - 200))}`);
        
        const validation = validateJsonResponse(fullText, serviceType || 'video');
        if (!validation.valid) {
            console.error(`[Gemini Stream] ❌ Validation failed: ${validation.code}`);
            if (validation.error) {
                console.error(`[Gemini Stream] Parse error: ${validation.error}`);
            }
            // Log a sample of what we got for debugging
            const sample = fullText.substring(0, 1000);
            console.error(`[Gemini Stream] Response sample (first 1000 chars):`, sample);
            sendSSE('error', { 
                error: 'AI върна невалиден формат. Никакви точки не бяха таксувани.', 
                code: validation.code,
                details: validation.error || 'Unknown validation error'
            });
            return res.end();
        }
        
        console.log(`[Gemini Stream] ✅ Validation successful. Parsed keys:`, Object.keys(validation.parsed || {}));

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

        // Extract metadata for transaction record (video title, author, etc.)
        const metadata = req.body.metadata || {};
        // For video analysis, include video metadata in transaction
        if (serviceType === 'video' || !serviceType) {
            metadata.videoTitle = metadata.title || metadata.videoTitle;
            metadata.videoAuthor = metadata.author || metadata.videoAuthor;
            metadata.videoId = metadata.videoId;
            metadata.videoDuration = metadata.duration;
            metadata.thumbnailUrl = metadata.thumbnailUrl; // If available from YouTube API
        }

        const deductResult = await deductPointsFromUser(userId, finalPoints, description, metadata);
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
