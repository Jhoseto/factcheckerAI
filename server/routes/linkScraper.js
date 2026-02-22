/**
 * Link Scraper Route
 * Primary: Jina Reader API (r.jina.ai) — handles JS-rendered sites.
 * Fallback: direct fetch + paragraph extraction.
 */

import express from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth.js';
import { getUserPoints } from '../services/firebaseAdmin.js';

const router = express.Router();

// ── Jina Reader ────────────────────────────────────────────────────────────────
async function fetchViaJina(url) {
    const response = await axios.get(`https://r.jina.ai/${url}`, {
        headers: {
            'Accept': 'text/plain',
            'X-Return-Format': 'text',
            'X-No-Cache': 'true',
        },
        timeout: 20000
    });
    return (response.data || '').toString().trim();
}

// ── Direct fetch fallback ──────────────────────────────────────────────────────
async function fetchDirect(url) {
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'bg,en;q=0.9',
        },
        timeout: 20000
    });

    const html = (response.data || '').toString();

    // Strip scripts, styles, nav, header, footer
    let clean = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, '');

    // Extract title
    const titleMatch = clean.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitleMatch = clean.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const title = (ogTitleMatch?.[1] || titleMatch?.[1] || '').trim();

    // Try article/main first, then paragraphs
    const articleMatch = clean.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i);
    let text = '';
    if (articleMatch) {
        text = articleMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    } else {
        const paras = [...clean.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
            .map(m => m[1].replace(/<[^>]*>/g, '').trim())
            .filter(t => t.length > 60);
        text = paras.join('\n\n');
    }

    return { title, text };
}

// ── Route ──────────────────────────────────────────────────────────────────────
router.post('/scrape', requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });
        try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

        let title = '';
        let content = '';

        // Try Jina first
        try {
            const jinaText = await fetchViaJina(url);
            if (jinaText && jinaText.length > 200) {
                const titleLine = jinaText.split('\n').find(l => l.startsWith('Title:'));
                title = titleLine ? titleLine.replace('Title:', '').trim() : '';
                content = jinaText;
                console.log(`[Scraper] ✅ Jina OK — ${content.length} chars`);
            }
        } catch (jinaErr) {
            console.warn(`[Scraper] ⚠️ Jina failed (${jinaErr.message}), trying direct fetch...`);
        }

        // Fallback: direct fetch
        if (!content || content.length < 200) {
            const direct = await fetchDirect(url);
            title = title || direct.title;
            content = direct.text;
            console.log(`[Scraper] ✅ Direct fetch OK — ${content.length} chars`);
        }

        // If we got very little — mark as partial so the prompt can compensate via Google Search
        const isPartial = !content || content.length < 300;
        if (isPartial) {
            console.warn(`[Scraper] ⚠️ Partial content (${content?.length || 0} chars) — Gemini will use Google Search`);
        }

        const siteName = new URL(url).hostname.replace('www.', '');
        const userPoints = await getUserPoints(req.userId);

        res.json({
            title,
            content: (content || '').substring(0, 35000),
            siteName,
            isPartial,
            url,
            points: { deducted: 0, costInPoints: 0, newBalance: userPoints }
        });

    } catch (error) {
        console.error('[Scraper] ❌ Error:', error.message);
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return res.status(400).json({ error: 'Сайтът не е достъпен.' });
        }
        if (error.response?.status === 403 || error.response?.status === 401) {
            return res.status(400).json({ error: 'Достъпът е ограничен (paywall).' });
        }
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return res.status(408).json({ error: 'Timeout — сайтът не отговори навреме.' });
        }
        res.status(500).json({ error: 'Грешка при извличане на съдържанието.', details: error.message });
    }
});

export default router;
