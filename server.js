// Cloud Run Deployment Sync - v1.0.3
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// Simple request logger
app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url}`);
    next();
});

// === API PROXIES (MUST BE BEFORE STATIC FILES) ===

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

// 3. LemnosLife API Proxy
const lemnosProxy = createProxyMiddleware({
    target: 'https://yt.lemnoslife.com',
    changeOrigin: true,
    pathRewrite: { '^/api/lemnos': '' },
    onProxyReq: (proxyReq, req) => {
        console.log(`[Proxy] Lemnos -> LemnosLife`);
    },
    onProxyRes: (proxyRes) => {
        console.log(`[Proxy] Lemnos <- ${proxyRes.statusCode}`);
    }
});
app.use('/api/lemnos', lemnosProxy);

// 4. Piped API Proxy
app.use('/api/piped', (req, res, next) => {
    const target = req.headers['x-piped-instance'] || 'https://pipedapi.kavin.rocks';
    const pipedProxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: { '^/api/piped': '' },
        onProxyReq: (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            console.log(`[Proxy] Piped -> ${target}`);
        },
        onProxyRes: (proxyRes) => {
            console.log(`[Proxy] Piped <- ${proxyRes.statusCode}`);
        }
    });
    pipedProxy(req, res, next);
});

// === STATIC FILES & SPA ROUTING ===

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing (history API fallback)
// This MUST be last to avoid catching API routes
app.get('*', (req, res) => {
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
