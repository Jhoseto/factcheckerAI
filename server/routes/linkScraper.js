/**
 * Link Scraper Route
 * Primary: Jina Reader API (r.jina.ai) — handles JS-rendered sites.
 * Fallback: direct fetch + paragraph extraction.
 * JINA_API_KEY in .env → higher rate limits (500 RPM).
 */

import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import dns from 'dns/promises';
import net from 'net';
import { requireAuth } from '../middleware/auth.js';
import { getUserPoints } from '../services/firebaseAdmin.js';

const router = express.Router();
const JINA_TIMEOUT = 20000;
const JINA_RETRIES = 2;
const DIRECT_TIMEOUT = 20000;
const MAX_HTML_BYTES = 2_000_000; // safety: ~2MB
const MAX_TEXT_CHARS = 80_000;

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
];
const pickUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

function isPrivateIp(ip) {
    // IPv4
    if (net.isIP(ip) === 4) {
        const [a, b] = ip.split('.').map(Number);
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 169 && b === 254) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 0) return true;
        return false;
    }
    // IPv6 (basic blocks)
    if (net.isIP(ip) === 6) {
        const s = ip.toLowerCase();
        if (s === '::1') return true;
        if (s.startsWith('fc') || s.startsWith('fd')) return true; // ULA
        if (s.startsWith('fe80:')) return true; // link-local
        return false;
    }
    return true;
}

async function assertSafeUrl(inputUrl) {
    const u = new URL(inputUrl);
    if (!['http:', 'https:'].includes(u.protocol)) {
        throw new Error('Invalid URL protocol');
    }
    const hostname = (u.hostname || '').toLowerCase();
    if (!hostname) throw new Error('Invalid URL hostname');
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('Unsafe URL');

    // If hostname is an IP, check directly; else resolve DNS.
    if (net.isIP(hostname)) {
        if (isPrivateIp(hostname)) throw new Error('Unsafe URL');
        return;
    }
    const records = await dns.lookup(hostname, { all: true });
    for (const r of records) {
        if (isPrivateIp(r.address)) throw new Error('Unsafe URL');
    }
}

function detectCharset(headers, htmlSnippet) {
    const ct = (headers?.['content-type'] || headers?.['Content-Type'] || '').toString();
    const m1 = ct.match(/charset\s*=\s*([^\s;]+)/i);
    if (m1?.[1]) return m1[1].replace(/["']/g, '').trim().toLowerCase();

    const m2 = htmlSnippet.match(/<meta[^>]+charset=["']?([^"'>\s]+)["']?/i);
    if (m2?.[1]) return m2[1].trim().toLowerCase();

    const m3 = htmlSnippet.match(/<meta[^>]+http-equiv=["']content-type["'][^>]+content=["'][^"']*charset=([^"';\s]+)[^"']*["']/i);
    if (m3?.[1]) return m3[1].trim().toLowerCase();

    return 'utf-8';
}

function normalizeText(text) {
    return (text || '')
        .replace(/\u00A0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

async function fetchViaJina(url) {
    const headers = {
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
        'X-No-Cache': 'true',
        'User-Agent': pickUA(),
    };
    const jinaKey = process.env.JINA_API_KEY;
    if (jinaKey) headers['Authorization'] = `Bearer ${jinaKey}`;

    let lastErr;
    for (let i = 0; i < JINA_RETRIES; i++) {
        try {
            const res = await axios.get(`https://r.jina.ai/${url}`, {
                headers,
                timeout: JINA_TIMEOUT,
                maxContentLength: MAX_HTML_BYTES,
                maxBodyLength: MAX_HTML_BYTES,
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

// ── Direct fetch fallback ──────────────────────────────────────────────────────
async function fetchDirect(url) {
    await assertSafeUrl(url);

    const response = await axios.get(url, {
        headers: {
            'User-Agent': pickUA(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'bg,en;q=0.9',
        },
        timeout: DIRECT_TIMEOUT,
        responseType: 'arraybuffer',
        maxContentLength: MAX_HTML_BYTES,
        maxBodyLength: MAX_HTML_BYTES,
        validateStatus: (s) => s < 500
    });

    const buf = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data || []);
    const sniff = buf.slice(0, 4096).toString('utf8');
    const charset = detectCharset(response.headers, sniff);
    const html = iconv.decode(buf, charset || 'utf-8');

    const $ = cheerio.load(html);
    $('script, style, nav, header, footer, aside, noscript').remove();

    const title = (
        $('meta[property="og:title"]').attr('content') ||
        $('title').text() ||
        ''
    ).trim();

    const metaDescription = (
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        ''
    ).trim();

    // Prefer semantic containers; then common CMS containers
    const articleLike = $('article, main, .article-body, .article__content, .post-content, .entry-content, .content, #content').first();
    let text = normalizeText(articleLike.text());

    // If empty, build from paragraphs
    if (!text || text.length < 200) {
        const paras = $('p')
            .map((_, el) => normalizeText($(el).text()))
            .get()
            .filter(t => t.length > 20);
        text = normalizeText(paras.join('\n\n'));
    }

    // If still empty, try JSON-LD fields
    if (!text || text.length < 200) {
        const candidates = [];
        $('script[type="application/ld+json"]').each((_, el) => {
            const raw = ($(el).text() || '').trim();
            if (!raw) return;
            try {
                const parsed = JSON.parse(raw);
                const arr = Array.isArray(parsed) ? parsed : [parsed];
                for (const obj of arr) {
                    if (!obj || typeof obj !== 'object') continue;
                    const body = obj.articleBody;
                    const desc = obj.description;
                    if (typeof body === 'string' && body.trim().length > 200) candidates.push(body.trim());
                    if (typeof desc === 'string' && desc.trim().length > 120) candidates.push(desc.trim());
                }
            } catch {
                // ignore
            }
        });
        if (candidates.length) text = candidates.sort((a, b) => b.length - a.length)[0];
    }

    // Cookie wall / paywall heuristics: if text is dominated by cookie/policy language, treat as partial
    const lower = (text || '').toLowerCase();
    const cookieWall = lower.includes('бисквит') || lower.includes('cookies') || lower.includes('privacy') || lower.includes('gdpr') || lower.includes('поверителност');

    // Last resort: body text + meta description
    if (!text || text.length < 120) {
        const bodyText = normalizeText($('body').text());
        text = normalizeText([title ? `Title: ${title}` : '', metaDescription ? `Description: ${metaDescription}` : '', bodyText].filter(Boolean).join('\n\n'));
    }

    if (text.length > MAX_TEXT_CHARS) text = text.substring(0, MAX_TEXT_CHARS);

    return { title, text, metaDescription, cookieWall };
}

// ── Route ──────────────────────────────────────────────────────────────────────
router.post('/scrape', requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });
        try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

        let title = '';
        let content = '';

        // Primary: Jina (best for JS-heavy / anti-bot sites). Fallback: direct fetch.
        let direct = null;
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

        if (!content || content.length < 200) {
            direct = await fetchDirect(url);
            title = title || direct.title;
            content = direct.text;
            const note = direct.cookieWall ? ' (cookie/paywall suspected)' : '';
            console.log(`[Scraper] ✅ Direct fetch OK — ${content.length} chars${note}`);
        }

        const lower = (content || '').toLowerCase();
        const cookieTokens = [
            'бисквит', 'cookies', 'gdpr', 'поверителност', 'privacy policy', 'terms of use',
            'условия за ползване', 'съгласие', 'consent', 'personal data', 'лични данни'
        ];
        const cookieHits = cookieTokens.reduce((acc, t) => acc + (lower.includes(t) ? 1 : 0), 0);
        const isCookieLike = cookieHits >= 3;

        const cameFromJina = !direct; // if we never needed direct fetch, content is from Jina

        // Mark as partial if we likely extracted cookie/paywall text instead of article body.
        // Important: do NOT aggressively mark Jina text as partial; it often includes nav/footer tokens.
        const isPartial =
            (!content || content.length < 600) ||
            (!!direct?.cookieWall) ||
            (!cameFromJina && isCookieLike && content.length < 6000);
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
        if ((error.message || '').includes('Unsafe URL') || (error.message || '').includes('Invalid URL protocol')) {
            return res.status(400).json({ error: 'Невалиден или небезопасен URL.' });
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
