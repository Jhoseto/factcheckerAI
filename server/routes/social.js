/**
 * Social Media Scraping Route
 * /api/social/scrape — Scrapes Facebook, Twitter/X, TikTok posts
 * 
 * Note: Real scraping requires server-side rendering or API access.
 * This is a basic implementation - for production, consider using
 * official APIs (Twitter API, Facebook Graph API) or a scraping service.
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

// Detect platform from URL
function detectPlatform(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) {
        return 'facebook';
    }
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
        return 'twitter';
    }
    if (urlLower.includes('tiktok.com')) {
        return 'tiktok';
    }
    return null;
}

/**
 * POST /api/social/scrape
 * Scrapes a social media post
 */
router.post('/scrape', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const platform = detectPlatform(url);
        if (!platform) {
            return res.status(400).json({
                error: 'Невалидна платформа. Поддържат се Facebook, Twitter/X, и TikTok.'
            });
        }


        // Basic scraping - in production, use official APIs
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,bg;q=0.8',
            },
            timeout: 15000
        });

        const html = response.data;

        // Extract basic info based on platform
        let postContent = '';
        let author = '';

        // Try to extract Open Graph metadata
        const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
        const ogDescription = html.match(/<meta property="og:description" content="([^"]+)"/i);
        const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i);

        // For Twitter/X, also check Twitter cards
        const twitterTitle = html.match(/<meta name="twitter:title" content="([^"]+)"/i);
        const twitterDesc = html.match(/<meta name="twitter:description" content="([^"]+)"/i);

        postContent = ogTitle?.[1] || twitterTitle?.[1] || 'Social Media Post';
        const description = ogDescription?.[1] || twitterDesc?.[1] || '';

        // Try to extract author from various meta tags
        const authorMatch = html.match(/<meta name="author" content="([^"]+)"/i)
            || html.match(/<meta property="article:author" content="([^"]+)"/i);
        author = authorMatch?.[1] || 'Unknown';

        // Extract engagement if available (very basic)
        const likeMatch = html.match(/(\d+[\d,.]*)\s*(likes|хеса)/i);
        const shareMatch = html.match(/(\d+[\d,.]*)\s*(shares|споделяния)/i);

        // Note: Full comment extraction requires JavaScript rendering or official API
        // For now, return empty comments array - can be enhanced later
        const result = {
            url,
            platform,
            postContent: postContent + (description ? '\n\n' + description : ''),
            author,
            likes: likeMatch ? parseInt(likeMatch[1].replace(/,/g, '')) : undefined,
            shares: shareMatch ? parseInt(shareMatch[1].replace(/,/g, '')) : undefined,
            comments: [], // Would require JS rendering or official API
            scrapedAt: new Date().toISOString()
        };


        res.json(result);

    } catch (error) {
        console.error('[Social Scrape] ❌ Error:', error.message);

        // Provide user-friendly error
        if (error.code === 'ENOTFOUND') {
            return res.status(400).json({
                error: 'URL-то не може да бъде достъпено. Проверете дали е валидно.'
            });
        }

        if (error.response?.status === 404) {
            return res.status(404).json({
                error: 'Публикацията не е намерена. Тя може да е била изтрита или да е private.'
            });
        }

        res.status(500).json({
            error: 'Грешка при извличане на публикацията. Моля, опитайте по-късно.'
        });
    }
});

export default router;
