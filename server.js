// Cloud Run Deployment Sync - v1.0.4
import 'dotenv/config';
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

        // Check if videoUrl is provided and determine how to handle it
        if (videoUrl) {
            // Check if it's a YouTube URL (including mobile formats: m.youtube.com, youtu.be, etc.)
            const isYouTubeUrl = /(?:youtube\.com|youtu\.be|m\.youtube\.com)/.test(videoUrl);
            
            if (isYouTubeUrl) {
                // For YouTube URLs, use fileData with fileUri (official method from Gemini docs)
                // This is exactly how Google AI Studio does it
                requestPayload.contents = [{
                    role: 'user',
                    parts: [
                        { 
                            fileData: { 
                                fileUri: videoUrl 
                            }
                        },
                        { 
                            text: prompt 
                        }
                    ]
                }];
            } else {
                // For other URLs (GCS, GDrive files), use fileUri
                // This is for files uploaded to Google Cloud Storage or Google Drive
                requestPayload.contents = [{
                    role: 'user',
                    parts: [
                        { fileData: { fileUri: videoUrl } },
                        { text: prompt }
                    ]
                }];
            }
        } else {
            // No video URL, just text prompt
            requestPayload.contents = [{
                role: 'user',
                parts: [{ text: prompt }]
            }];
        }

        const response = await ai.models.generateContent(requestPayload);

        res.json({
            text: response.text,
            usageMetadata: response.usageMetadata
        });

    } catch (error) {
        console.error('[Gemini API] Error:', error);
        
        // Check for API key errors
        const errorMessage = error.message || error.toString() || '';
        const isApiKeyError = 
            errorMessage.includes('API key') ||
            errorMessage.includes('api key') ||
            errorMessage.includes('API_KEY') ||
            errorMessage.includes('authentication') ||
            errorMessage.includes('401') ||
            errorMessage.includes('Unauthorized') ||
            errorMessage.includes('invalid') && errorMessage.includes('key') ||
            error.status === 401 ||
            error.statusCode === 401;
        
        // Check for rate limit errors
        const isRateLimitError = 
            errorMessage.includes('429') ||
            errorMessage.includes('rate limit') ||
            errorMessage.includes('quota') ||
            error.status === 429 ||
            error.statusCode === 429;
        
        // Return appropriate status code
        if (isApiKeyError) {
            return res.status(401).json({
                error: 'API key error: Invalid or missing API key. Please check your .env file configuration.',
                code: 'API_KEY_ERROR'
            });
        }
        
        if (isRateLimitError) {
            return res.status(429).json({
                error: 'Rate limit exceeded. Please wait 1-2 minutes before trying again.',
                code: 'RATE_LIMIT'
            });
        }
        
        // Default error
        res.status(500).json({
            error: error.message || 'Failed to generate content',
            code: 'UNKNOWN_ERROR'
        });
    }
});

// === YOUTUBE METADATA API (SERVER-SIDE) ===
// This keeps the YouTube API key secure on the server
app.get('/api/youtube/metadata', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        
        if (!videoUrl || typeof videoUrl !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid video URL parameter' });
        }

        // Extract video ID from URL
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

        // Get YouTube API key from environment
        const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'YouTube API key not configured' });
        }

        // Call YouTube Data API v3
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            console.error(`[YouTube Metadata] API request failed: ${response.status} ${response.statusText}`);
            return res.status(response.status).json({ error: `YouTube API error: ${response.status}` });
        }

        const data = await response.json();
        if (!data.items || data.items.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const video = data.items[0];
        const snippet = video.snippet;
        const contentDetails = video.contentDetails;

        // Parse ISO 8601 duration
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

// 1. YouTube oEmbed Proxy
const oembedProxy = createProxyMiddleware({
    target: 'https://www.youtube.com',
    changeOrigin: true,
    pathRewrite: { '^/api/oembed': '/oembed' },
    onProxyReq: (proxyReq, req) => {
    },
    onProxyRes: (proxyRes) => {
    }
});
app.use('/api/oembed', oembedProxy);

// 2. YouTube Direct Scrape Proxy
// IMPORTANT: This must NOT catch /api/youtube/metadata - that route is handled above
const youtubeProxy = createProxyMiddleware({
    target: 'https://www.youtube.com',
    changeOrigin: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    pathRewrite: { '^/api/youtube': '' },
    onProxyReq: (proxyReq, req) => {
    },
    onProxyRes: (proxyRes) => {
    }
});
// Only apply proxy to /api/youtube paths that are NOT /api/youtube/metadata
app.use('/api/youtube', (req, res, next) => {
    // Skip /metadata route - it's handled by the specific route above
    if (req.path.startsWith('/metadata')) {
        return next();
    }
    youtubeProxy(req, res, next);
});

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
});
