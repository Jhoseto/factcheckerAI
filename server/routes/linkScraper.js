/**
 * Link Scraper Route
 * /api/link/scrape — Scrapes web article content for analysis
 */

import express from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth.js';
import { getUserPoints, deductPointsFromUser } from '../services/firebaseAdmin.js';
import { getFixedPrice } from '../config/pricing.js';

const router = express.Router();

router.post('/scrape', requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        // Basic URL validation
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        const userId = req.userId;
        const price = getFixedPrice('link'); // Usually 15 points

        // Check balance
        const currentBalance = await getUserPoints(userId);
        if (currentBalance < price) {
            return res.status(403).json({
                error: 'Insufficient points. Please top up your balance.',
                code: 'INSUFFICIENT_POINTS',
                currentBalance
            });
        }

        console.log(`[Scraper] 🌐 Fetching content from: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'bg,en;q=0.9',
            },
            timeout: 15000,
            maxRedirects: 5
        });

        const html = response.data;

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'Link Analysis';

        // Extract meta description
        const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
        const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';

        // Extract OG title/description for better accuracy
        const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
        const ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : '';

        // Clean HTML
        let cleanText = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
            .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
            .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');

        // Extract article/main content first
        const articleMatch = cleanText.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
            || cleanText.match(/<main[^>]*>([\s\S]*?)<\/main>/i);

        let content = '';
        if (articleMatch) {
            content = articleMatch[1]
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        } else {
            // Fallback: extract paragraphs
            const pMatches = cleanText.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
            if (pMatches) {
                content = pMatches
                    .map(p => p.replace(/<[^>]*>/g, '').trim())
                    .filter(text => text.length > 40)
                    .join('\n\n');
            }
        }

        // Final fallback: body text
        if (!content || content.length < 200) {
            const bodyMatch = cleanText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            if (bodyMatch) {
                content = bodyMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            } else {
                content = cleanText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            }
        }

        // Limit content length
        const truncatedContent = content.substring(0, 30000);

        // Deduct points
        const deductResult = await deductPointsFromUser(userId, price);
        if (!deductResult.success) {
            return res.status(403).json({
                error: 'Insufficient points after generation.',
                code: 'INSUFFICIENT_POINTS',
                currentBalance: deductResult.newBalance
            });
        }

        res.json({
            title: ogTitle || title,
            content: truncatedContent,
            metaDescription,
            siteName: new URL(url).hostname.replace('www.', ''),
            url,
            points: {
                deducted: price,
                costInPoints: price,
                newBalance: deductResult.newBalance
            }
        });

    } catch (error) {
        console.error('[Scraper] ❌ Error:', error.message);

        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return res.status(400).json({ error: 'Сайтът не е достъпен. Проверете URL адреса.' });
        }
        if (error.response?.status === 403) {
            return res.status(400).json({ error: 'Сайтът блокира автоматичен достъп.' });
        }
        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ error: 'Сайтът не отговори навреме.' });
        }

        res.status(500).json({
            error: 'Неуспешно извличане на съдържанието. Моля, опитайте по-късно.',
            details: error.message
        });
    }
});

export default router;
