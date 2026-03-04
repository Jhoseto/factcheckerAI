/**
 * Social Media Scraper Route
 * Extracts OG meta (title, description, image) from social post URLs.
 * For full content, use /api/link/scrape.
 */

import express from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function extractOgMeta(html) {
    const meta = {};
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i);
    const twitterTitle = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']*)["']/i);
    const twitterDesc = html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']*)["']/i);
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    meta.title = (ogTitle?.[1] || twitterTitle?.[1] || titleTag?.[1] || '').trim();
    meta.description = (ogDesc?.[1] || twitterDesc?.[1] || '').trim();
    meta.image = (ogImage?.[1] || '').trim();
    return meta;
}

router.post('/scrape', requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });
        try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; FactCheckerAI/1.0)',
                'Accept': 'text/html,application/xhtml+xml',
            },
            timeout: 15000
        });
        const html = (response.data || '').toString();
        const meta = extractOgMeta(html);
        const content = [meta.title, meta.description].filter(Boolean).join('\n\n');

        res.json({
            title: meta.title,
            content: content || 'No extractable content',
            image: meta.image,
            isPartial: content.length < 100,
            url
        });
    } catch (error) {
        console.error('[Social Scraper] Error:', error.message);
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return res.status(400).json({ error: 'URL is not accessible.' });
        }
        if (error.response?.status === 403 || error.response?.status === 401) {
            return res.status(400).json({ error: 'Access restricted.' });
        }
        res.status(500).json({ error: 'Scrape failed.', details: error.message });
    }
});

export default router;
