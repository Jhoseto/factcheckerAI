
import { YouTubeVideoMetadata } from '../types';

/**
 * Extract video ID from YouTube URL
 */
export const extractVideoId = (url: string): string | null => {
    // Normalize URL - remove any trailing slashes and whitespace
    const normalizedUrl = url.trim();

    const patterns = [
        // Standard formats
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/embed\/([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/,
        // Mobile formats
        /(?:m\.youtube\.com\/watch\?v=|m\.youtube\.com\/shorts\/)([^&\n?#]+)/,
        // Shorts format
        /youtube\.com\/shorts\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
        const match = normalizedUrl.match(pattern);
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
 * Fetch YouTube video metadata using server-side API endpoint
 * This keeps the API key secure on the server and works in Cloud Run
 */
export const getYouTubeMetadata = async (url: string): Promise<YouTubeVideoMetadata> => {
    try {
        // Use server-side endpoint instead of direct API call
        // This allows the API key to be stored securely on the server
        const apiUrl = `/api/youtube/metadata?url=${encodeURIComponent(url)}`;

        const response = await fetch(apiUrl);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            console.error('[YouTube Metadata] Response error:', response.status, errorData);
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error: any) {
        console.error('[YouTube Metadata] Fetch error:', error);
        // Check if it's a network error
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
            throw new Error('Грешка при извличане на метаданни: Не може да се свърже със сървъра. Моля, проверете дали сървърът работи на порт 8080.');
        }
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
