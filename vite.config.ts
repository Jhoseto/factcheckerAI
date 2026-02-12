import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/gemini': {
          target: 'http://localhost:8080',
          changeOrigin: true
        },
        // YouTube metadata API - must be before /api/youtube to match first
        '/api/youtube/metadata': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
          ws: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to the Target:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            });
          }
        },
        '/api/oembed': {
          target: 'https://www.youtube.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/oembed/, '/oembed')
        },
        // NOTE: /api/youtube proxy removed - it was interfering with /api/youtube/metadata
        // The general /api/youtube proxy is only used in server.js for server-side scraping
        // and doesn't need to be in Vite proxy config
        '/api/piped': {
          target: 'https://pipedapi.kavin.rocks',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/piped/, '')
        },
        '/api/lemnos': {
          target: 'https://yt.lemnoslife.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/lemnos/, '')
        },
        '/api/lemonsqueezy': {
          target: 'http://localhost:8080',
          changeOrigin: true
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
