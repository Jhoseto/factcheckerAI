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

// Replicate Vite proxy logic for production
// Using pathFilter to ensure pathRewrite sees the full URL path
app.use(createProxyMiddleware({
    pathFilter: '/api/oembed',
    target: 'https://www.youtube.com',
    changeOrigin: true,
    secure: false,
    pathRewrite: {
        '^/api/oembed': '/oembed',
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] oEmbed: Forwarding ${req.originalUrl} to YouTube`);
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy] oEmbed: Received ${proxyRes.statusCode}`);
    }
}));

app.use(createProxyMiddleware({
    pathFilter: '/api/youtube',
    target: 'https://www.youtube.com',
    changeOrigin: true,
    secure: false,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    pathRewrite: {
        '^/api/youtube': '',
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] YouTube: Forwarding ${req.originalUrl} to YouTube`);
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy] YouTube: Received ${proxyRes.statusCode}`);
    }
}));

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing (history API fallback)
// Using a basic middleware for the catch-all to avoid path-to-regexp version issues
app.use((req, res, next) => {
    // Skip if it's an API call or anything that reached here but shouldn't have
    if (req.url.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    // For anything else, serve index.html
    res.sendFile(path.join(__dirname, 'dist', 'index.html'), (err) => {
        if (err) {
            console.error('[Server] Error sending index.html:', err);
            res.status(500).send('Error loading application');
        }
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] STARTED: FactChecker AI listening on port ${port}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'production'}`);
});
