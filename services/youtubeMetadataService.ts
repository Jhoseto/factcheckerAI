
import { YouTubeVideoMetadata } from '../types';

/**
 * Extract video ID from YouTube URL
 */
export const extractVideoId = (url: string): string | null => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/embed\/([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
};

const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://api-piped.mha.fi',
    'https://piped-api.lunar.icu'
];

/**
 * Fetch duration from Lemnos API (Highly reliable fallback)
 */
const fetchDurationFromLemnos = async (videoId: string): Promise<number | null> => {
    try {
        console.log(`[YouTube Metadata] Trying LemnosLife API for ${videoId}...`);
        const response = await fetch(`/api/lemnos/no-auth/videos?id=${videoId}&part=contentDetails`);

        if (!response.ok) {
            console.warn(`[YouTube Metadata] Lemnos API failed: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const durationStr = data?.items?.[0]?.contentDetails?.duration;

        if (durationStr) {
            const seconds = parseISODuration(durationStr);
            console.log(`[YouTube Metadata] Lemnos Success: ${seconds}s`);
            return seconds;
        }
        return null;
    } catch (error) {
        console.error('[YouTube Metadata] Lemnos Error:', error);
        return null;
    }
};

/**
 * Helper to parse ISO 8601 duration (e.g. PT1H2M30S)
 */
const parseISODuration = (iso: string): number => {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const h = parseInt(match[1] || '0', 10);
    const m = parseInt(match[2] || '0', 10);
    const s = parseInt(match[3] || '0', 10);
    return h * 3600 + m * 60 + s;
};

/**
 * Fetch duration from Piped API as a fallback
 */
const fetchDurationFromPiped = async (videoId: string): Promise<number | null> => {
    for (const instance of PIPED_INSTANCES) {
        try {
            console.log(`[YouTube Metadata] Trying Piped (${instance}) for ${videoId}...`);
            const response = await fetch(`/api/piped/streams/${videoId}`, {
                headers: { 'x-piped-instance': instance }
            });

            if (!response.ok) {
                console.warn(`[YouTube Metadata] Piped API fetch failed (${instance}): ${response.status}`);
                continue;
            }

            const data = await response.json();
            if (data && typeof data.duration === 'number') {
                console.log(`[YouTube Metadata] Success! Found Piped duration: ${data.duration}s`);
                return data.duration;
            }
        } catch (error) {
            console.warn(`[YouTube Metadata] Piped API error for ${instance}:`, error);
        }
    }
    return null;
};

/**
 * Scrape actual duration from YouTube page HTML via local proxy
 * This is the most reliable method locally but often blocked in Cloud.
 */
const scrapeDurationFromYouTubeProxy = async (videoId: string): Promise<number | null> => {
    try {
        console.log(`[YouTube Metadata] Scraping duration for ${videoId} via local proxy...`);
        // Fetch the video page HTML via our proxy to avoid CORS
        const response = await fetch(`/api/youtube/watch?v=${videoId}`);

        if (!response.ok) {
            console.warn(`[YouTube Metadata] Proxy fetch failed: ${response.status}`);
            return null;
        }

        const html = await response.text();

        // Strategy 1: Look for "lengthSeconds" in the client-side configuration
        const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
        if (lengthMatch && lengthMatch[1]) {
            const seconds = parseInt(lengthMatch[1], 10);
            console.log(`[YouTube Metadata] Found "lengthSeconds": ${seconds}`);
            return seconds;
        }

        // Strategy 2: Look for microformat duration (ISO 8601)
        const isoMatch = html.match(/"duration":"PT(\d+H)?(\d+M)?(\d+S)?"/);
        if (isoMatch) {
            let totalSeconds = 0;
            if (isoMatch[1]) totalSeconds += parseInt(isoMatch[1].replace('H', '')) * 3600;
            if (isoMatch[2]) totalSeconds += parseInt(isoMatch[2].replace('M', '')) * 60;
            if (isoMatch[3]) totalSeconds += parseInt(isoMatch[3].replace('S', ''));
            console.log(`[YouTube Metadata] Found ISO duration: ${totalSeconds}`);
            return totalSeconds > 0 ? totalSeconds : null;
        }

        return null;
    } catch (error) {
        console.warn('[YouTube Metadata] Scraping error:', error);
        return null;
    }
};

/**
 * Fetch YouTube video metadata using oEmbed API + HTML Scraping for duration
 * This combines official metadata with accurate duration from direct page access
 */
export const getYouTubeMetadata = async (url: string): Promise<YouTubeVideoMetadata> => {
    const videoId = extractVideoId(url);

    if (!videoId) {
        throw new Error('Невалиден YouTube URL');
    }

    try {
        // 1. Get basic metadata from official YouTube oEmbed (fast, reliable)
        // Using local proxy /api/oembed to bypass CORS during development
        const oembedUrl = `/api/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(oembedUrl);

        if (!response.ok) {
            throw new Error('Не може да се извлече информация за видеото');
        }

        const data = await response.json();

        // 2. Get accurate duration
        // Step A: Try direct scraping (works best locally)
        let actualDuration = await scrapeDurationFromYouTubeProxy(videoId);

        // Step B: Try LemnosLife (Highly reliable)
        if (!actualDuration) {
            actualDuration = await fetchDurationFromLemnos(videoId);
        }

        // Step C: Try Piped API fallback
        if (!actualDuration) {
            actualDuration = await fetchDurationFromPiped(videoId);
        }

        // Use actual duration if found, otherwise default to 10 mins (600s)
        const duration = actualDuration || 600;
        const durationFormatted = formatDuration(duration);

        return {
            videoId,
            title: data.title || 'Неизвестно заглавие',
            author: data.author_name || 'Неизвестен автор',
            duration,
            durationFormatted
        };
    } catch (error: any) {
        throw new Error(`Грешка при извличане на метаданни: ${error.message}`);
    }
};

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Parse duration string (MM:SS or HH:MM:SS) to seconds
 */
export const parseDuration = (duration: string): number => {
    const parts = duration.split(':').map(Number);

    if (parts.length === 3) {
        // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        // MM:SS
        return parts[0] * 60 + parts[1];
    }

    return 0;
};
