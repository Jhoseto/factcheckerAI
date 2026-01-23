
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
 * Fetch YouTube video metadata using official YouTube Data API v3
 * This is the ONLY reliable way to get video data in production
 */
export const getYouTubeMetadata = async (url: string): Promise<YouTubeVideoMetadata> => {
    const videoId = extractVideoId(url);

    if (!videoId) {
        throw new Error('Невалиден YouTube URL');
    }

    console.log(`[YouTube Metadata] Fetching data for video ID: ${videoId}`);

    try {
        // Use official YouTube Data API v3
        // Format: https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id={videoId}&key={apiKey}
        const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY || 'AIzaSyCmbAtvix1RtSo3GDOrCI0soJsYwkZYrNY';
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;

        console.log(`[YouTube Metadata] Calling YouTube Data API v3...`);
        const response = await fetch(apiUrl);

        if (!response.ok) {
            console.error(`[YouTube Metadata] API request failed: ${response.status} ${response.statusText}`);
            throw new Error(`YouTube API грешка: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[YouTube Metadata] API Response:`, data);

        if (!data.items || data.items.length === 0) {
            throw new Error('Видеото не е намерено');
        }

        const video = data.items[0];
        const snippet = video.snippet;
        const contentDetails = video.contentDetails;

        // Parse duration from ISO 8601 format (e.g., "PT1M30S" = 90 seconds)
        const durationISO = contentDetails?.duration || 'PT10M';
        const duration = parseISODuration(durationISO);
        const durationFormatted = formatDuration(duration);

        console.log(`[YouTube Metadata] Successfully parsed:`, {
            title: snippet?.title,
            author: snippet?.channelTitle,
            duration,
            durationFormatted
        });

        return {
            videoId,
            title: snippet?.title || 'Неизвестно заглавие',
            author: snippet?.channelTitle || 'Неизвестен автор',
            duration,
            durationFormatted
        };
    } catch (error: any) {
        console.error('[YouTube Metadata] Error:', error);
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
