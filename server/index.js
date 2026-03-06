/**
 * FactChecker AI — Server Entry Point
 * =====================================
 * Modular Express server. All routes are in server/routes/
 * All middleware is in server/middleware/
 *
 * Cloud Run Deployment Sync - v2.0.0
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { initializeFirebaseAdmin } from './services/firebaseAdmin.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';

// Route modules
import geminiRouter from './routes/gemini.js';
import youtubeRouter from './routes/youtube.js';
import linkScraperRouter from './routes/linkScraper.js';
import checkoutRouter from './routes/checkout.js';
import webhookRouter from './routes/webhook.js';
import socialRouter from './routes/social.js';
import transactionsRouter from './routes/transactions.js';
import adminRouter from '../admin/server/index.js';
import { chatBotRouter, setupChatBotSocket } from '../chatBot/server/index.js';
import visitTrackRouter from './routes/visitTrack.js';
import publicConfigRouter from './routes/publicConfig.js';
import userMessagesRouter from './routes/userMessages.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const port = process.env.PORT || 8080;

// ─────────────────────────────────────────────────────────────────────────────
// Security Headers
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Global Rate Limiter (IP-based)
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api', globalRateLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// Body Parsers
// Webhook needs raw body for HMAC verification — must be before express.json()
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/gemini', express.json({ limit: '50mb' }));
app.use('/api/lemonsqueezy/checkout', express.json({ limit: '1mb' }));
app.use('/api/youtube/metadata', express.json({ limit: '1mb' }));
app.use('/api/link', express.json({ limit: '1mb' }));
app.use('/api/social', express.json({ limit: '2mb' }));

// ─────────────────────────────────────────────────────────────────────────────
// Initialize Firebase Admin
// ─────────────────────────────────────────────────────────────────────────────
try {
    initializeFirebaseAdmin();
} catch (error) {
    console.error('[Server] Failed to initialize Firebase Admin:', error.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/gemini', geminiRouter);
app.use('/api/link', linkScraperRouter);
app.use('/api/lemonsqueezy', checkoutRouter);
app.use('/api/lemonsqueezy', webhookRouter);
app.use('/api/social', socialRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/track', express.json({ limit: '10kb' }), visitTrackRouter);
app.use('/api/config', publicConfigRouter);
app.use('/api/user-messages', userMessagesRouter);
app.use('/api/admin', express.json({ limit: '1mb' }), adminRouter);

// ─────────────────────────────────────────────────────────────────────────────
// YouTube Proxy & Routes
// ─────────────────────────────────────────────────────────────────────────────
const youtubeProxy = createProxyMiddleware({
    target: 'https://www.youtube.com',
    changeOrigin: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    pathRewrite: { '^/api/youtube': '' }
});

// Priority: Metadata API first, then Proxy
app.use('/api/youtube', (req, res, next) => {
    if (req.path.startsWith('/metadata')) {
        return youtubeRouter(req, res, next);
    }
    youtubeProxy(req, res, next);
});

// ─────────────────────────────────────────────────────────────────────────────
// YouTube oEmbed Proxy
// ─────────────────────────────────────────────────────────────────────────────
const oembedProxy = createProxyMiddleware({
    target: 'https://www.youtube.com',
    changeOrigin: true,
    pathRewrite: { '^/api/oembed': '/oembed' }
});
app.use('/api/oembed', oembedProxy);

// ─────────────────────────────────────────────────────────────────────────────
// Static Files & SPA Routing
// ─────────────────────────────────────────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        console.error(`[Server] Unhandled API request: ${req.path}`);
        return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Server + Socket.io (for ChatBot)
// ─────────────────────────────────────────────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: true, methods: ['GET', 'POST'] }
});
setupChatBotSocket(io);

httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[Server] Listening on port ${port}`);
});

export default app;
