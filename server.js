// Cloud Run Deployment Sync - v1.0.1
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
app.use('/api/oembed', createProxyMiddleware({
    target: 'https://www.youtube.com',
    changeOrigin: true,
    secure: false,
    pathRewrite: {
        '^/api/oembed': '/oembed',
    },
    onProxyReq: (proxyReq, req) => {
        console.log(`[Proxy] oEmbed: ${req.originalUrl}`);
    }
}));

// 2. YouTube Direct Scrape Proxy
app.use('/api/youtube', createProxyMiddleware({
    target: 'https://www.youtube.com',
    changeOrigin: true,
    secure: false,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    pathRewrite: {
        '^/api/youtube': '',
    },
    onProxyReq: (proxyReq, req) => {
        console.log(`[Proxy] Scrape: ${req.originalUrl}`);
    }
}));

// 3. LemnosLife API Proxy (Fallback)
app.use('/api/lemnos', createProxyMiddleware({
    target: 'https://yt.lemnoslife.com',
    changeOrigin: true,
    secure: false,
    pathRewrite: {
        '^/api/lemnos': '',
    },
    onProxyReq: (proxyReq, req) => {
        console.log(`[Proxy] Lemnos: ${req.originalUrl}`);
    }
}));

// 4. Piped API Proxy (Fallback)
app.use('/api/piped', createProxyMiddleware({
    target: 'https://pipedapi.kavin.rocks',
    changeOrigin: true,
    secure: false,
    router: (req) => {
        return req.headers['x-piped-instance'] || 'https://pipedapi.kavin.rocks';
    },
    pathRewrite: {
        '^/api/piped': '',
    },
    onProxyReq: (proxyReq, req) => {
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        console.log(`[Proxy] Piped: ${req.originalUrl}`);
    }
}));

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing (history API fallback)
app.use((req, res) => {
    // If it's an API call that wasn't caught, return 404
    if (req.url.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] STARTED: FactChecker AI listening on port ${port}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'production'}`);
});
