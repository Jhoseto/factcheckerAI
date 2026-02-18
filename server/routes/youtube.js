/**
 * YouTube API Routes
 * /api/youtube/metadata — Video metadata via YouTube Data API v3
 */

import express from 'express';

const router = express.Router();

function parseISODuration(iso) {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    return (parseInt(match[1] || '0', 10) * 3600)
        + (parseInt(match[2] || '0', 10) * 60)
        + parseInt(match[3] || '0', 10);
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/embed\/([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/,
        /(?:m\.youtube\.com\/watch\?v=|m\.youtube\.com\/shorts\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match?.[1]) return match[1];
    }
    return null;
}

router.get('/metadata', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        if (!videoUrl || typeof videoUrl !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid video URL parameter' });
        }

        const videoId = extractVideoId(videoUrl);
        if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

        const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'YouTube API key not configured' });

        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            return res.status(response.status).json({ error: `YouTube API error: ${response.status}` });
        }

        const data = await response.json();
        if (!data.items || data.items.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const video = data.items[0];
        const snippet = video.snippet;
        const contentDetails = video.contentDetails;
        const durationISO = contentDetails?.duration || 'PT10M';
        const duration = parseISODuration(durationISO);

        res.json({
            videoId,
            title: snippet?.title || 'Неизвестно заглавие',
            author: snippet?.channelTitle || 'Неизвестен автор',
            duration,
            durationFormatted: formatDuration(duration),
            thumbnailUrl: snippet?.thumbnails?.high?.url || snippet?.thumbnails?.default?.url || ''
        });
    } catch (error) {
        console.error('[YouTube Metadata] Error:', error.message);
        res.status(500).json({ error: `Error fetching metadata: ${error.message}` });
    }
});

export default router;
