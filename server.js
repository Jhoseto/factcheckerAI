// Cloud Run Deployment Sync - v1.0.2
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

// 1. YouTube oEmbed Proxy
app.use('/api/oembed', (req, res, next) => {
    createProxyMiddleware({
        target: 'https://www.youtube.com',
        changeOrigin: true,
        pathRewrite: { '^/api/oembed': '/oembed' },
        onProxyReq: () => console.log(`[Proxy] oEmbed: ${req.originalUrl}`)
    })(req, res, next);
});

// 2. YouTube Direct Scrape Proxy
app.use('/api/youtube', (req, res, next) => {
    createProxyMiddleware({
        target: 'https://www.youtube.com',
        changeOrigin: true,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        pathRewrite: { '^/api/youtube': '' },
        onProxyReq: () => console.log(`[Proxy] Scrape: ${req.originalUrl}`)
    })(req, res, next);
});

// 3. LemnosLife API Proxy
app.use('/api/lemnos', (req, res, next) => {
    createProxyMiddleware({
        target: 'https://yt.lemnoslife.com',
        changeOrigin: true,
        pathRewrite: { '^/api/lemnos': '' },
        onProxyReq: () => console.log(`[Proxy] Lemnos: ${req.originalUrl}`)
    })(req, res, next);
});

// 4. Piped API Proxy
app.use('/api/piped', (req, res, next) => {
    const target = req.headers['x-piped-instance'] || 'https://pipedapi.kavin.rocks';
    createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: { '^/api/piped': '' },
        onProxyReq: (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            console.log(`[Proxy] Piped (${target}): ${req.originalUrl}`);
        }
    })(req, res, next);
});

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing (history API fallback)
app.use((req, res) => {
    if (req.url.startsWith('/api')) {
        console.warn(`[Server] Unhandled API request: ${req.url}`);
        return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] STARTED: FactChecker AI listening on port ${port}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'production'}`);
});
