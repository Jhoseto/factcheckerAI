// Cloud Run Deployment Sync - v1.0.4
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { GoogleGenAI } from '@google/genai';
import { initializeFirebaseAdmin, addPointsToUser } from './services/firebaseAdmin.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// Set security headers - relaxed for Firebase Auth compatibility
app.use((req, res, next) => {
    // Allow Firebase Auth popups to work - use unsafe-none to prevent blocking
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    next();
});

// JSON parsing middleware for API routes (except webhooks which need raw body)
app.use('/api/gemini', express.json({ limit: '50mb' }));
app.use('/api/lemonsqueezy/checkout', express.json({ limit: '1mb' }));
app.use('/api/youtube/metadata', express.json({ limit: '1mb' }));
app.use('/api/link/scrape', express.json({ limit: '1mb' }));

import axios from 'axios';

// === LINK SCRAPER ENDPOINT ===
app.post('/api/link/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        console.log(`[Scraper] 🌐 Fetching content from: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            timeout: 10000
        });

        const html = response.data;

        // Basic extraction logic without external heavy libraries
        // Extract Title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'Link Analysis';

        // Extract main text content (very basic heuristic: look for paragraphs)
        // Clean up script and style tags first
        let cleanText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        cleanText = cleanText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

        // Extract paragraphs
        const pMatches = cleanText.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
        let content = '';

        if (pMatches) {
            content = pMatches
                .map(p => p.replace(/<[^>]*>/g, '').trim())
                .filter(text => text.length > 40) // Filter out short fragments
                .join('\n\n');
        }

        // If no paragraphs found, fallback to body text but stripped of tags
        if (!content || content.length < 200) {
            const bodyMatch = cleanText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            if (bodyMatch) {
                content = bodyMatch[1]
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            } else {
                content = cleanText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            }
        }

        // Limit content length for Gemini safety
        const truncatedContent = content.substring(0, 30000);

        res.json({
            title,
            content: truncatedContent,
            siteName: new URL(url).hostname.replace('www.', '')
        });

    } catch (error) {
        console.error('[Scraper] ❌ Error scraping URL:', error.message);
        res.status(500).json({
            error: 'Неуспешно извличане на съдържанието от линка. Моля, опитайте по-късно или проверете дали сайтът позволява достъп.',
            details: error.message
        });
    }
});

// Initialize Firebase Admin SDK
try {
    initializeFirebaseAdmin();
} catch (error) {
    console.error('[Server] Failed to initialize Firebase Admin - points crediting will not work');
}

// === GEMINI API PROXY (SERVER-SIDE) ===
// This keeps the API key secure on the server
app.post('/api/gemini/generate', async (req, res) => {
    // Set timeout to 15 minutes for long video analysis
    req.setTimeout(900000); // 15 minutes
    res.setTimeout(900000);

    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY;

        if (!apiKey) {
            console.error('[Gemini API] No API key found in environment');
            return res.status(500).json({ error: 'Server configuration error: Missing API key' });
        }

        // 1. Verify Authentication
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const { verifyToken, getUserPoints, deductPointsFromUser } = await import('./services/firebaseAdmin.js');

        let userId;
        try {
            userId = await verifyToken(idToken);
            if (!userId) throw new Error('Invalid token');
        } catch (e) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        // 2. Check Balance (Minimum 10 points to start)
        const currentBalance = await getUserPoints(userId);
        if (currentBalance < 10) {
            return res.status(403).json({
                error: 'Insufficient points. Please top up your balance.',
                code: 'INSUFFICIENT_POINTS',
                currentBalance
            });
        }

        // 3. Perform Generation
        const { model, prompt, systemInstruction, videoUrl, isBatch, enableGoogleSearch, mode } = req.body;

        const ai = new GoogleGenAI({ apiKey });

        const isDeepMode = mode === 'deep';
        const tools = (isDeepMode || enableGoogleSearch) ? [{ googleSearch: {} }] : undefined;

        // Use SDK for ALL requests (streaming for video, regular for text)
        // This avoids Node.js undici headers timeout bug with REST API fetch
        let response;
        const contents = [];

        if (videoUrl) {
            // SDK streaming for YouTube video - avoids undici timeout
            contents.push({
                role: 'user',
                parts: [
                    { fileData: { mimeType: 'video/mp4', fileUri: videoUrl } },
                    { text: prompt }
                ]
            });

            // Use streaming to avoid timeout - collect all chunks
            console.log('[Gemini API] Starting streaming request for video:', videoUrl);
            const stream = await ai.models.generateContentStream({
                model: model || 'gemini-2.5-flash',
                contents,
                config: {
                    systemInstruction: systemInstruction || 'You are a professional fact-checker and media analyst. Respond ONLY with valid JSON.',
                    temperature: 0.7,
                    maxOutputTokens: isDeepMode ? 65536 : 20000,
                    responseMimeType: tools ? undefined : 'application/json',
                    mediaResolution: 'MEDIA_RESOLUTION_LOW',
                    tools: tools
                }
            });

            let fullText = '';
            let streamUsage = null;

            for await (const chunk of stream) {
                if (chunk.text) fullText += chunk.text;
                if (chunk.usageMetadata) streamUsage = chunk.usageMetadata;
            }

            console.log('[Gemini API] Streaming complete. Total chars:', fullText.length);

            // Build response object matching SDK format
            response = {
                text: fullText,
                usageMetadata: streamUsage
            };
        } else {
            // Regular metadata-only generation
            contents.push({
                role: 'user',
                parts: [{ text: prompt }]
            });
            response = await ai.models.generateContent({
                model: model || 'gemini-2.5-flash',
                contents,
                config: {
                    systemInstruction: systemInstruction || 'You are a professional fact-checker and media analyst. Respond ONLY with valid JSON.',
                    temperature: 0.7,
                    maxOutputTokens: isDeepMode ? 65536 : 20000,
                    responseMimeType: tools ? undefined : 'application/json',
                    tools: tools
                }
            });
        }

        let responseText = '';
        let usage = null;


        // Handle response formats
        if (videoUrl) {
            // Streaming response
            responseText = response.text || '';
            usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
        } else {
            // SDK single response format
            responseText = response.text || '';
            usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };
        }

        // Log actual token usage for calibration
        console.log('[Gemini API] Token Usage:', JSON.stringify(usage));

        // === FAIR BILLING VALIDATION ===
        if (!responseText || responseText.length < 10) {
            console.error('[Gemini API] ❌ AI returned empty or too short response. Skipping deduction.');
            return res.status(500).json({
                error: 'AI не успя да генерира валиден анализ. Моля, опитайте отново. (Никакви точки не бяха таксувани)',
                code: 'AI_EMPTY_RESPONSE'
            });
        }

        try {
            let trimmed = responseText.trim();
            // Try to find JSON if it's wrapped in markdown
            const jsonMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                trimmed = jsonMatch[1].trim();
            } else {
                const firstBrace = trimmed.indexOf('{');
                const lastBrace = trimmed.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    trimmed = trimmed.substring(firstBrace, lastBrace + 1);
                }
            }

            if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
                console.error('[Gemini API] ❌ Response does not look like JSON:', trimmed.substring(0, 100));
                if (!trimmed.includes('{') && !trimmed.includes('[')) {
                    throw new Error('Not a JSON response');
                }
            }
            // We don't verify JSON validity here entirely, client does that. 
            // We just ensure it LOOKS like JSON to justify billing.
        } catch (e) {
            console.error('[Gemini API] ❌ AI returned non-JSON response. Skipping deduction. Error:', e.message);
            return res.status(500).json({
                error: 'AI върна невалиден формат. Моля, опитайте отново. (Никакви точки не бяха таксувани)',
                code: 'AI_INVALID_FORMAT'
            });
        }

        // === PRICING CALCULATION ===

        // Use STANDARD pricing for ALL requests (Base Price)
        // Gemini 2.5 Flash ($0.50 Input / $2.00 Output)
        const SELECTED_PRICING = { input: 0.50, output: 2.00, audio: 1.00 };

        const BATCH_DISCOUNT = isBatch ? 0.5 : 1.0;
        const COST_PER_INPUT_TOKEN = (SELECTED_PRICING.input / 1000000) * BATCH_DISCOUNT;
        const COST_PER_OUTPUT_TOKEN = (SELECTED_PRICING.output / 1000000) * BATCH_DISCOUNT;

        // Calculate Cost in USD
        const inputCostUSD = usage.promptTokenCount * COST_PER_INPUT_TOKEN;
        const outputCostUSD = usage.candidatesTokenCount * COST_PER_OUTPUT_TOKEN;
        const totalCostUSD = inputCostUSD + outputCostUSD;

        // Convert to EUR (0.95 rate)
        const totalCostEur = totalCostUSD * 0.95;

        // Formula: EUR * 100 * 2 (Standard Multiplier = x2 profit)
        let pointsDeducted = Math.ceil(totalCostEur * 200);

        // === DEEP ANALYSIS: x1.5 additional (total x3 profit) ===
        const isDeep = enableGoogleSearch === true;

        if (isDeep) {
            pointsDeducted = Math.ceil(pointsDeducted * 1.5); // x2 base * x1.5 = x3 total
        }

        // Minimum points (5 for Standard, 10 for Deep)
        const finalPoints = Math.max(isDeep ? 10 : 5, pointsDeducted);

        console.log(`[Gemini API] Billing: Input=${usage.promptTokenCount} tokens ($${inputCostUSD.toFixed(4)}) | Output=${usage.candidatesTokenCount} tokens ($${outputCostUSD.toFixed(4)}) | Total=$${totalCostUSD.toFixed(4)} | EUR=${totalCostEur.toFixed(4)} | Points=${finalPoints} (isDeep=${isDeep})`);

        // DO NOT deduct points here. Deduction is handled by the client AFTER successful UI render.
        res.json({
            text: responseText,
            usageMetadata: usage,
            points: {
                deducted: 0,
                costInPoints: finalPoints,
                costEur: totalCostEur,
                isDeep: isDeep
            }
        });

    } catch (error) {
        console.error('[Gemini API] Error:', error);

        const errorMessage = error.message || error.toString() || '';

        if (errorMessage.includes('401') || errorMessage.includes('API key')) {
            return res.status(401).json({ error: 'API key error', code: 'API_KEY_ERROR' });
        }

        res.status(500).json({
            error: error.message || 'Failed to generate content',
            code: 'UNKNOWN_ERROR'
        });
    }
});

// === SSE STREAMING ENDPOINT ===
// Streams Gemini responses in real-time so client can show progress
app.post('/api/gemini/generate-stream', async (req, res) => {
    req.setTimeout(900000);
    res.setTimeout(900000);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendSSE = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY;
        if (!apiKey) {
            sendSSE('error', { error: 'Server configuration error: Missing API key' });
            return res.end();
        }

        // Auth
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            sendSSE('error', { error: 'Unauthorized' });
            return res.end();
        }

        const idToken = authHeader.split('Bearer ')[1];
        const { verifyToken, getUserPoints } = await import('./services/firebaseAdmin.js');

        let userId;
        try {
            userId = await verifyToken(idToken);
            if (!userId) throw new Error('Invalid token');
        } catch (e) {
            sendSSE('error', { error: 'Unauthorized: Invalid token' });
            return res.end();
        }

        const currentBalance = await getUserPoints(userId);
        if (currentBalance < 10) {
            sendSSE('error', { error: 'Insufficient points', code: 'INSUFFICIENT_POINTS', currentBalance });
            return res.end();
        }

        const { model, prompt, systemInstruction, videoUrl, isBatch, enableGoogleSearch, mode } = req.body;
        const ai = new GoogleGenAI({ apiKey });

        const isDeepMode = mode === 'deep';
        const tools = (isDeepMode || enableGoogleSearch) ? [{ googleSearch: {} }] : undefined;

        const contents = [{
            role: 'user',
            parts: videoUrl
                ? [{ fileData: { mimeType: 'video/mp4', fileUri: videoUrl } }, { text: prompt }]
                : [{ text: prompt }]
        }];

        sendSSE('progress', { status: 'Изпращане на заявка ...' });

        const stream = await ai.models.generateContentStream({
            model: model || 'gemini-2.5-flash',
            contents,
            config: {
                systemInstruction: systemInstruction || 'You are a professional fact-checker and media analyst. Respond ONLY with valid JSON.',
                temperature: 0.7,
                maxOutputTokens: isDeepMode ? 65536 : 50000,
                responseMimeType: tools ? undefined : 'application/json',
                mediaResolution: 'MEDIA_RESOLUTION_LOW',
                tools: tools
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
                // Send progress every few chunks to avoid flooding
                if (chunkCount % 5 === 0) {
                    sendSSE('progress', { status: `Анализиране (${Math.round(fullText.length / 1024)} KB)...` });
                }
            }

            if (chunk.usageMetadata) {
                streamUsage = chunk.usageMetadata;
            }
        }

        const responseText = fullText;
        const usage = streamUsage || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

        // Billing validation
        if (!responseText || responseText.length < 10) {
            sendSSE('error', { error: 'AI не успя да генерира валиден анализ.', code: 'AI_EMPTY_RESPONSE' });
            return res.end();
        }

        // JSON validation
        try {
            let trimmed = responseText.trim();
            const jsonMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                trimmed = jsonMatch[1].trim();
            } else {
                const firstBrace = trimmed.indexOf('{');
                const lastBrace = trimmed.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    trimmed = trimmed.substring(firstBrace, lastBrace + 1);
                }
            }
            if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
                if (!trimmed.includes('{') && !trimmed.includes('[')) {
                    throw new Error('Not a JSON response');
                }
            }
        } catch (e) {
            sendSSE('error', { error: 'AI върна невалиден формат.', code: 'AI_INVALID_FORMAT' });
            return res.end();
        }

        // Pricing
        const SELECTED_PRICING = { input: 0.50, output: 2.00, audio: 1.00 };
        const BATCH_DISCOUNT = isBatch ? 0.5 : 1.0;
        const inputCostUSD = (usage.promptTokenCount || 0) * (SELECTED_PRICING.input / 1000000) * BATCH_DISCOUNT;
        const outputCostUSD = (usage.candidatesTokenCount || 0) * (SELECTED_PRICING.output / 1000000) * BATCH_DISCOUNT;
        const totalCostEur = (inputCostUSD + outputCostUSD) * 0.95;
        let pointsDeducted = Math.ceil(totalCostEur * 200);

        const isDeep = enableGoogleSearch || (model && (model.includes('3-flash') || model.includes('pro')));
        if (isDeep) pointsDeducted *= 2;
        const finalPoints = Math.max(isDeep ? 10 : 5, pointsDeducted);

        // Send complete event with full response
        sendSSE('complete', {
            text: responseText,
            usageMetadata: usage,
            points: {
                deducted: 0,
                costInPoints: finalPoints,
                costEur: totalCostEur,
                isDeep: isDeep
            }
        });
        res.end();

    } catch (error) {
        console.error('[Gemini Stream API] Error:', error?.message || error);
        console.error('[Gemini Stream API] Stack:', error?.stack);
        try {
            sendSSE('error', { error: error.message || 'Failed to generate content', code: 'UNKNOWN_ERROR' });
        } catch (writeErr) {
            console.error('[Gemini Stream API] Could not send error SSE:', writeErr.message);
        }
        res.end();
    }
});

// === REPORT SYNTHESIS ENDPOINT ===
// Text-only call that generates a professional journalistic report from analysis data
app.post('/api/gemini/synthesize-report', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Missing API key' });
        }

        // Auth
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const { verifyToken } = await import('./services/firebaseAdmin.js');
        try {
            const userId = await verifyToken(idToken);
            if (!userId) throw new Error('Invalid');
        } catch (e) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Missing prompt' });
        }

        const ai = new GoogleGenAI({ apiKey });

        console.log('[Report Synthesis] Starting text-only generation...');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                temperature: 0.8,
                maxOutputTokens: 16000
            }
        });

        let reportText = '';
        if (typeof response.text === 'string') {
            reportText = response.text;
        } else if (typeof response.text === 'function') {
            reportText = response.text();
        } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
            reportText = response.candidates[0].content.parts[0].text;
        }

        console.log('[Report Synthesis] Complete. Length:', reportText.length);

        res.json({ report: reportText });
    } catch (error) {
        console.error('[Report Synthesis] Error:', error?.message || error);
        res.status(500).json({ error: error.message || 'Report synthesis failed' });
    }
});

// === YOUTUBE METADATA API (SERVER-SIDE) ===
app.get('/api/youtube/metadata', async (req, res) => {
    try {
        const videoUrl = req.query.url;

        if (!videoUrl || typeof videoUrl !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid video URL parameter' });
        }

        const extractVideoId = (url) => {
            const patterns = [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
                /youtube\.com\/embed\/([^&\n?#]+)/,
                /youtube\.com\/v\/([^&\n?#]+)/,
                /(?:m\.youtube\.com\/watch\?v=|m\.youtube\.com\/shorts\/)([^&\n?#]+)/,
                /youtube\.com\/shorts\/([^&\n?#]+)/
            ];
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) return match[1];
            }
            return null;
        };

        const videoId = extractVideoId(videoUrl);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'YouTube API key not configured' });
        }

        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            console.error(`[YouTube Metadata] API request failed: ${response.status}`);
            return res.status(response.status).json({ error: `YouTube API error: ${response.status}` });
        }

        const data = await response.json();
        if (!data.items || data.items.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const video = data.items[0];
        const snippet = video.snippet;
        const contentDetails = video.contentDetails;

        const parseISODuration = (iso) => {
            const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (!match) return 0;
            const h = parseInt(match[1] || '0', 10);
            const m = parseInt(match[2] || '0', 10);
            const s = parseInt(match[3] || '0', 10);
            return h * 3600 + m * 60 + s;
        };

        const formatDuration = (seconds) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            if (hours > 0) {
                return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        };

        const durationISO = contentDetails?.duration || 'PT10M';
        const duration = parseISODuration(durationISO);
        const durationFormatted = formatDuration(duration);

        res.json({
            videoId,
            title: snippet?.title || 'Неизвестно заглавие',
            author: snippet?.channelTitle || 'Неизвестен автор',
            duration,
            durationFormatted
        });
    } catch (error) {
        console.error('[YouTube Metadata] Error:', error);
        res.status(500).json({ error: `Error fetching metadata: ${error.message}` });
    }
});

// === API PROXIES (YOUTUBE) ===

const oembedProxy = createProxyMiddleware({
    target: 'https://www.youtube.com',
    changeOrigin: true,
    pathRewrite: { '^/api/oembed': '/oembed' }
});
app.use('/api/oembed', oembedProxy);

const youtubeProxy = createProxyMiddleware({
    target: 'https://www.youtube.com',
    changeOrigin: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    pathRewrite: { '^/api/youtube': '' }
});

app.use('/api/youtube', (req, res, next) => {
    if (req.path.startsWith('/metadata')) {
        return next();
    }
    youtubeProxy(req, res, next);
});

// === LEMON SQUEEZY CHECKOUT API ===
app.post('/api/lemonsqueezy/checkout', async (req, res) => {
    try {
        const { variantId, userId, userEmail, points } = req.body;

        if (!variantId) {
            return res.status(400).json({ error: 'Variant ID is required' });
        }

        const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
        const storeId = process.env.LEMON_SQUEEZY_STORE_ID;

        if (!apiKey || !storeId) {
            console.error('[Lemon Squeezy] Missing API_KEY or STORE_ID');
            return res.status(500).json({ error: 'Lemon Squeezy not configured' });
        }

        const origin = req.headers.origin || req.headers.referer || `${req.protocol}://${req.get('host')}`;
        const redirectUrl = origin.replace(/\/$/, '') + '/';

        const checkout = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.api+json',
                'Content-Type': 'application/vnd.api+json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                data: {
                    type: 'checkouts',
                    attributes: {
                        product_options: {
                            redirect_url: redirectUrl
                        },
                        checkout_data: {
                            email: userEmail,
                            custom: {
                                user_id: userId,
                                points: points.toString()
                            }
                        }
                    },
                    relationships: {
                        store: {
                            data: {
                                type: 'stores',
                                id: storeId
                            }
                        },
                        variant: {
                            data: {
                                type: 'variants',
                                id: variantId
                            }
                        }
                    }
                }
            })
        });

        const checkoutData = await checkout.json();

        if (checkoutData.data && checkoutData.data.attributes && checkoutData.data.attributes.url) {
            res.json({
                checkoutUrl: checkoutData.data.attributes.url
            });
        } else {
            console.error('[Lemon Squeezy] ❌ API error:', JSON.stringify(checkoutData, null, 2));
            res.status(500).json({ error: 'Failed to create checkout' });
        }

    } catch (error) {
        console.error('[Lemon Squeezy] ❌ Checkout error:', error.message);
        res.status(500).json({ error: 'Failed to create checkout' });
    }
});

// === LEMON SQUEEZY WEBHOOK ===
app.post('/api/lemonsqueezy/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
        const signature = req.headers['x-signature'];

        if (webhookSecret) {
            const hmac = crypto.createHmac('sha256', webhookSecret);
            const digest = hmac.update(req.body).digest('hex');

            if (!signature || !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
                console.error('[Lemon Squeezy] Invalid signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }

        let event;
        try {
            if (Buffer.isBuffer(req.body)) {
                event = JSON.parse(req.body.toString());
            } else if (typeof req.body === 'string') {
                event = JSON.parse(req.body);
            } else {
                event = req.body;
            }
        } catch (parseError) {
            console.error('[Lemon Squeezy] JSON Parse Error:', parseError);
            return res.status(400).json({ error: 'Invalid JSON body' });
        }

        if (event && (event.meta.event_name === 'order_created' || event.meta.event_name === 'order_paid') && event.data.attributes.status === 'paid') {
            const attributes = event.data.attributes;
            let customData = {};

            if (attributes.checkout_data && attributes.checkout_data.custom) {
                customData = attributes.checkout_data.custom;
            } else if (attributes.first_order_item && attributes.first_order_item.custom_data) {
                customData = attributes.first_order_item.custom_data;
            } else if (event.meta && event.meta.custom_data) {
                customData = event.meta.custom_data;
            }

            const userId = customData.userId || customData.user_id;
            const points = parseInt(customData.points) || 0;

            if (userId && points > 0) {
                try {
                    await addPointsToUser(userId, points);
                } catch (error) {
                    console.error(`[Lemon Squeezy] ❌ Failed to add points for user ${userId}:`, error);
                }
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error('[Lemon Squeezy] Webhook error:', error);
        res.status(400).json({ error: 'Webhook processing failed' });
    }
});

// === STATIC FILES & SPA ROUTING ===
app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        console.error(`[Server] ERROR: Unhandled API request reached catch-all: ${req.path}`);
        return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
});
