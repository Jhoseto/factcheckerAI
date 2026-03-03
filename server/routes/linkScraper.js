/**
 * Link Scraper Route
 * Primary: Jina Reader API (r.jina.ai) — handles JS-rendered sites.
 * Fallback: direct fetch + paragraph extraction.
 * JINA_API_KEY in .env → higher rate limits (500 RPM).
 */

import express from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth.js';
import { getUserPoints } from '../services/firebaseAdmin.js';

const router = express.Router();
const JINA_TIMEOUT = 45000;
const JINA_RETRIES = 2;

async function fetchViaJina(url) {
    const headers = {
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
        'X-No-Cache': 'true',
    };
    const jinaKey = process.env.JINA_API_KEY;
    if (jinaKey) headers['Authorization'] = `Bearer ${jinaKey}`;

    let lastErr;
    for (let i = 0; i < JINA_RETRIES; i++) {
        try {
            const res = await axios.get(`https://r.jina.ai/${url}`, {
                headers,
                timeout: JINA_TIMEOUT,
                validateStatus: (s) => s < 500
            });
            if (res.status === 200 && res.data) {
                return (res.data || '').toString().trim();
            }
            lastErr = new Error(`Jina HTTP ${res.status}`);
        } catch (e) {
            lastErr = e;
            if (i < JINA_RETRIES - 1) await new Promise(r => setTimeout(r, 1500));
        }
    }
    throw lastErr;
}

// ── Article-relevant image extraction (exclude banners, ads, logos) ─────────────
const IMAGE_URL_BLACKLIST = /banner|ad[s]?|logo|icon|avatar|thumbnail|pixel|tracking|social|share|facebook|twitter|widget|button|spinner|placeholder|1x1|pixel\.|gravatar|emoji|sprite/i;
const MIN_IMAGE_DIM = 80;
const MAX_ARTICLE_IMAGES = 4;
const IMAGE_FETCH_TIMEOUT = 10000;
const MAX_IMAGE_BYTES = 500000;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function fetchImagesAsBase64(urls, maxCount = 4) {
    const result = [];
    for (const url of urls.slice(0, maxCount)) {
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: IMAGE_FETCH_TIMEOUT,
                maxContentLength: MAX_IMAGE_BYTES,
                maxBodyLength: MAX_IMAGE_BYTES,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FactcheckerBot/1.0)' }
            });
            const ct = (res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
            if (!ALLOWED_MIMES.some(m => ct.includes(m.split('/')[1]))) continue;
            const mimeType = ct.startsWith('image/') ? ct : 'image/jpeg';
            const base64 = Buffer.from(res.data).toString('base64');
            result.push({ mimeType, data: base64 });
        } catch (e) {
            console.warn(`[Scraper] Image fetch failed (${url.slice(0, 50)}...):`, e.message);
        }
    }
    return result;
}

function resolveUrl(src, baseUrl) {
    if (!src || typeof src !== 'string') return null;
    src = src.trim().split(/[\s,]/)[0];
    if (!src) return null;
    try {
        return new URL(src, baseUrl).href;
    } catch {
        return null;
    }
}

function extractImagesFromMarkdown(md, baseUrl) {
    const urls = [];
    const re = /!\[[^\]]*\]\s*\(\s*([^)\s]+)\s*\)/g;
    let m;
    while ((m = re.exec(md)) !== null && urls.length < MAX_ARTICLE_IMAGES) {
        const u = resolveUrl(m[1].trim(), baseUrl);
        if (u && !IMAGE_URL_BLACKLIST.test(u.toLowerCase())) urls.push(u);
    }
    return urls;
}

function extractImgSrcs(tag) {
    const src = (tag.match(/src=["']([^"']+)["']/i) || [])[1];
    const dataSrc = (tag.match(/data-src=["']([^"']+)["']/i) || [])[1];
    const srcset = (tag.match(/srcset=["']([^"']+)["']/i) || [])[1];
    const urls = [];
    if (src) urls.push(src.trim());
    if (dataSrc) urls.push(dataSrc.trim());
    if (srcset) {
        const first = srcset.split(/[\s,]+/)[0]?.trim();
        if (first) urls.push(first);
    }
    return urls.filter(Boolean);
}

function extractArticleImageUrls(html, baseUrl) {
    const seen = new Set();
    const urls = [];
    try {
        const areas = [];
        const articleMatch = html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i);
        if (articleMatch) areas.push(articleMatch[1]);
        const contentDiv = html.match(/<div[^>]*(?:class|id)=["'][^"']*(?:post-content|article-body|entry-content|content-body|story-body|article-content|post-body|entry-body)[^"']*["'][^>]*>([\s\S]*)/i);
        if (contentDiv) areas.push(contentDiv[1].slice(0, 80000));
        areas.push(html);
        for (const area of areas) {
            const imgTags = area.match(/<img[^>]+>/gi) || [];
            for (const tag of imgTags) {
                if (urls.length >= MAX_ARTICLE_IMAGES) break;
                for (const src of extractImgSrcs(tag)) {
                    const fullUrl = resolveUrl(src, baseUrl);
                    if (!fullUrl || seen.has(fullUrl)) continue;
                    const lower = fullUrl.toLowerCase();
                    if (IMAGE_URL_BLACKLIST.test(lower)) continue;
                    const w = (tag.match(/width=["']?(\d+)/i) || [])[1];
                    const h = (tag.match(/height=["']?(\d+)/i) || [])[1];
                    const dim = Math.min(parseInt(w, 10) || 999, parseInt(h, 10) || 999);
                    if (dim > 0 && dim < MIN_IMAGE_DIM) continue;
                    seen.add(fullUrl);
                    urls.push(fullUrl);
                    break;
                }
            }
            if (urls.length > 0) break;
        }
        if (urls.length === 0) {
            const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
            if (ogImg) {
                const u = resolveUrl(ogImg[1], baseUrl);
                if (u && !IMAGE_URL_BLACKLIST.test(u.toLowerCase())) urls.push(u);
            }
            const jsonLd = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
            if (jsonLd) {
                for (const block of jsonLd) {
                    const m = block.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
                    if (!m) continue;
                    try {
                        const obj = typeof m[1] === 'string' ? JSON.parse(m[1]) : null;
                        const arr = Array.isArray(obj) ? obj : (obj ? [obj] : []);
                        for (const item of arr) {
                            const img = item?.image || item?.thumbnailUrl;
                            const u = Array.isArray(img) ? img[0] : (typeof img === 'string' ? img : null);
                            if (u) {
                                const full = resolveUrl(u, baseUrl);
                                if (full && !seen.has(full) && !IMAGE_URL_BLACKLIST.test(full.toLowerCase())) {
                                    seen.add(full);
                                    urls.push(full);
                                    break;
                                }
                            }
                        }
                        if (urls.length > 0) break;
                    } catch (_) {}
                }
            }
        }
    } catch (e) {
        console.warn('[Scraper] Image extraction error:', e.message);
    }
    return urls.slice(0, MAX_ARTICLE_IMAGES);
}

// ── Direct fetch fallback ──────────────────────────────────────────────────────
async function fetchDirect(url) {
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'bg,en;q=0.9',
        },
        timeout: 25000
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

    const imageUrls = extractArticleImageUrls(clean, url);
    return { title, text, html: clean, imageUrls };
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

        let imageUrls = [];
        if (!content || content.length < 200) {
            const direct = await fetchDirect(url);
            title = title || direct.title;
            content = direct.text;
            imageUrls = direct.imageUrls || [];
            console.log(`[Scraper] ✅ Direct fetch OK — ${content.length} chars, ${imageUrls.length} images`);
        } else {
            // Jina succeeded — fetch HTML for images, fallback to markdown
            try {
                const imgRes = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml',
                        'Accept-Language': 'bg,en;q=0.9',
                    },
                    timeout: 15000
                });
                const html = (imgRes.data || '').toString();
                imageUrls = extractArticleImageUrls(html, url);
                if (imageUrls.length) console.log(`[Scraper] ✅ Images from HTML — ${imageUrls.length}`);
            } catch (e) {
                console.warn(`[Scraper] ⚠️ Image fetch failed: ${e.message}`);
            }
            if (imageUrls.length === 0 && content) {
                const mdUrls = extractImagesFromMarkdown(content, url);
                if (mdUrls.length) {
                    imageUrls = mdUrls;
                    console.log(`[Scraper] ✅ Images from Jina markdown — ${imageUrls.length}`);
                }
            }
        }

        const isPartial = !content || content.length < 300;
        if (isPartial) {
            console.warn(`[Scraper] ⚠️ Partial content (${content?.length || 0} chars) — Gemini will use Google Search`);
        }

        let images = [];
        if (imageUrls.length > 0) {
            images = await fetchImagesAsBase64(imageUrls, 4);
            if (images.length) console.log(`[Scraper] ✅ Fetched ${images.length} images as base64`);
        }

        const siteName = new URL(url).hostname.replace('www.', '');
        const userPoints = await getUserPoints(req.userId);

        res.json({
            title,
            content: (content || '').substring(0, 35000),
            imageUrls,
            images,
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
