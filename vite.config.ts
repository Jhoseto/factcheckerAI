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
        '/api/oembed': {
          target: 'https://www.youtube.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/oembed/, '/oembed')
        },
        // Direct YouTube page proxy to scrape duration from HTML (more reliable than Piped)
        '/api/youtube': {
          target: 'https://www.youtube.com',
          changeOrigin: true,
          secure: false, // Handle HTTPS
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          rewrite: (path) => path.replace(/^\/api\/youtube/, '')
        },
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
