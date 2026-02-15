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

// Initialize Firebase Admin SDK
try {
    initializeFirebaseAdmin();
} catch (error) {
    console.error('[Server] Failed to initialize Firebase Admin - points crediting will not work');
}

// === GEMINI API PROXY (SERVER-SIDE) ===
// This keeps the API key secure on the server
app.post('/api/gemini/generate', async (req, res) => {
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
        const { model, prompt, systemInstruction, videoUrl, isBatch } = req.body;
        const ai = new GoogleGenAI({ apiKey });

        const requestPayload = {
            model: model || 'gemini-3-flash-preview',
            systemInstruction: systemInstruction || 'You are a professional fact-checker and media analyst. Respond ONLY with valid JSON.',
            contents: [],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.7
            },
            tools: []
        };

        if (videoUrl) {
            requestPayload.contents = [{
                role: 'user',
                parts: [{ fileData: { fileUri: videoUrl } }, { text: prompt }]
            }];
        } else {
            requestPayload.contents = [{
                role: 'user',
                parts: [{ text: prompt }]
            }];
        }

        const response = await ai.models.generateContent(requestPayload);

        let responseText = '';
        if (typeof response.text === 'function') {
            responseText = response.text();
        } else if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
            responseText = response.candidates[0].content.parts[0].text;
        } else {
            responseText = JSON.stringify(response);
        }
        const usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };

        const PRICING = {
            'flash3': { input: 0.50, output: 3.00, audio: 1.00 },
            'flash2_5': { input: 0.30, output: 2.50, audio: 1.00 },
            'pro': { input: 0.50, output: 3.00, audio: 1.00 }
        };

        const modelId = requestPayload.model || 'gemini-3-flash-preview';
        let selectedPricing = PRICING.flash3;

        if (modelId.includes('2.5-flash')) {
            selectedPricing = PRICING.flash2_5;
        } else if (modelId.includes('pro')) {
            selectedPricing = PRICING.pro;
        }

        // === FAIR BILLING VALIDATION ===
        if (!responseText || responseText.length < 10) {
            console.error('[Gemini API] ❌ AI returned empty or too short response. Skipping deduction.');
            return res.status(500).json({
                error: 'AI не успя да генерира валиден анализ. Моля, опитайте отново. (Никакви точки не бяха таксувани)',
                code: 'AI_EMPTY_RESPONSE'
            });
        }

        try {
            const trimmed = responseText.trim();
            if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
                if (!trimmed.includes('{') && !trimmed.includes('[')) {
                    throw new Error('Not a JSON response');
                }
            }
        } catch (e) {
            console.error('[Gemini API] ❌ AI returned non-JSON response. Skipping deduction.');
            return res.status(500).json({
                error: 'AI върна невалиден формат. Моля, опитайте отново. (Никакви точки не бяха таксувани)',
                code: 'AI_INVALID_FORMAT'
            });
        }

        const BATCH_DISCOUNT = isBatch ? 0.5 : 1.0;
        const COST_PER_INPUT_TOKEN = (selectedPricing.input / 1000000) * BATCH_DISCOUNT;
        const COST_PER_OUTPUT_TOKEN = (selectedPricing.output / 1000000) * BATCH_DISCOUNT;
        const inputCost = usage.promptTokenCount * COST_PER_INPUT_TOKEN;
        const outputCost = usage.candidatesTokenCount * COST_PER_OUTPUT_TOKEN;
        const totalCostEur = inputCost + outputCost;

        const pointsDeducted = Math.ceil(totalCostEur * 200);
        const finalPoints = Math.max(1, pointsDeducted);

        // DO NOT deduct points here. Deduction is handled by the client AFTER successful UI render.
        // This ensures the user is only charged if the analysis is actually displayed.

        res.json({
            text: responseText,
            usageMetadata: usage,
            points: {
                deducted: 0,
                costInPoints: finalPoints,
                costEur: totalCostEur
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

            const userId = customData.user_id;
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
