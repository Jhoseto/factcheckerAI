// Cloud Run Deployment Sync - v1.0.4
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// Parse JSON bodies for API requests
app.use(express.json({ limit: '10mb' }));

// Simple request logger
app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url}`);
    next();
});

// === GEMINI API PROXY (SERVER-SIDE) ===
// This keeps the API key secure on the server
app.post('/api/gemini/generate', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY;

        if (!apiKey) {
            console.error('[Gemini API] No API key found in environment');
            return res.status(500).json({ error: 'Server configuration error: Missing API key' });
        }

        const { model, prompt, systemInstruction, videoUrl } = req.body;

        console.log(`[Gemini API] Generating content with model: ${model}`);

        const ai = new GoogleGenAI({ apiKey });

        const requestPayload = {
            model: model || 'gemini-2.0-flash-exp',
            systemInstruction: systemInstruction || 'You are a professional fact-checker and media analyst. Respond ONLY with valid JSON.',
            contents: [],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.7
            }
        };

        // Add video if provided
        if (videoUrl) {
            requestPayload.contents.push({
                role: 'user',
                parts: [
                    { fileData: { fileUri: videoUrl } },
                    { text: prompt }
                ]
            });
        } else {
            requestPayload.contents.push({
                role: 'user',
                parts: [{ text: prompt }]
            });
        }

        const response = await ai.models.generateContent(requestPayload);

        console.log(`[Gemini API] Success - generated ${response.text?.length || 0} characters`);

        res.json({
            text: response.text,
            usageMetadata: response.usageMetadata
        });

    } catch (error) {
        console.error('[Gemini API] Error:', error);
        res.status(500).json({
            error: error.message || 'Failed to generate content'
        });
    }
});

// === API PROXIES (YOUTUBE) ===

// 1. YouTube oEmbed Proxy
const oembedProxy = createProxyMiddleware({
    target: 'https://www.youtube.com',
    changeOrigin: true,
    pathRewrite: { '^/api/oembed': '/oembed' },
    onProxyReq: (proxyReq, req) => {
        console.log(`[Proxy] oEmbed -> YouTube`);
    },
    onProxyRes: (proxyRes) => {
        console.log(`[Proxy] oEmbed <- ${proxyRes.statusCode}`);
    }
});
app.use('/api/oembed', oembedProxy);

// 2. YouTube Direct Scrape Proxy
const youtubeProxy = createProxyMiddleware({
    target: 'https://www.youtube.com',
    changeOrigin: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    pathRewrite: { '^/api/youtube': '' },
    onProxyReq: (proxyReq, req) => {
        console.log(`[Proxy] Scrape -> YouTube`);
    },
    onProxyRes: (proxyRes) => {
        console.log(`[Proxy] Scrape <- ${proxyRes.statusCode}`);
    }
});
app.use('/api/youtube', youtubeProxy);

// === STATIC FILES & SPA ROUTING ===

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing (history API fallback)
// This MUST be last to avoid catching API routes
app.use((req, res) => {
    // Safety check: if somehow an API request reaches here, don't serve HTML
    if (req.path.startsWith('/api')) {
        console.error(`[Server] ERROR: Unhandled API request reached catch-all: ${req.path}`);
        return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] STARTED: FactChecker AI listening on port ${port}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'production'}`);
});
