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
// IMPORTANT: Use the object-style config for newer http-proxy-middleware
app.use('/api/oembed', createProxyMiddleware({
    target: 'https://www.youtube.com',
    changeOrigin: true,
    secure: false,
    pathRewrite: {
        '^/api/oembed': '/oembed',
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] Forwarding ${req.url} to YouTube oEmbed`);
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy] Received ${proxyRes.statusCode} from YouTube oEmbed`);
    },
    onError: (err, req, res) => {
        console.error('[Proxy] Error in oEmbed proxy:', err);
    }
}));

app.use('/api/youtube', createProxyMiddleware({
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
        console.log(`[Proxy] Forwarding ${req.url} to YouTube Direct`);
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy] Received ${proxyRes.statusCode} from YouTube Direct`);
    }
}));

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing (history API fallback)
// Only catch requests that don't start with /api to avoid sending HTML for failed API calls
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
