/**
 * URL validation utilities
 */

/**
 * Validate YouTube URL
 * @param url - The URL to validate
 * @returns Object with valid flag and optional error message
 */
export const validateYouTubeUrl = (url: string): { valid: boolean; error?: string } => {
  if (!url.trim()) {
    return { valid: false, error: 'Моля, въведете URL' };
  }

  const youtubePatterns = [
    /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\/.+/,
    /^https?:\/\/youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/youtube\.com\/embed\/[\w-]+/,
    /^https?:\/\/m\.youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtube\.com\/shorts\/[\w-]+/,
    /^https?:\/\/m\.youtube\.com\/shorts\/[\w-]+/
  ];

  const isValid = youtubePatterns.some(pattern => pattern.test(url.trim()));

  if (!isValid) {
    return {
      valid: false,
      error: 'Невалиден YouTube URL. Моля, използвайте формат: https://www.youtube.com/watch?v=... или https://youtu.be/... или https://m.youtube.com/watch?v=...'
    };
  }

  return { valid: true };
};

/**
 * Normalize YouTube URL to standard desktop format
 * Converts mobile (m.youtube.com) and shortened (youtu.be) URLs to standard format
 * @param url - The YouTube URL to normalize
 * @returns Normalized YouTube URL in standard desktop format
 */
export const normalizeYouTubeUrl = (url: string): string => {
  try {
    const trimmedUrl = url.trim();

    // Extract video ID from various formats
    let videoId = '';

    // youtu.be/VIDEO_ID
    const shortMatch = trimmedUrl.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch) {
      videoId = shortMatch[1];
    }

    // youtube.com/watch?v=VIDEO_ID (including m.youtube.com)
    const watchMatch = trimmedUrl.match(/[?&]v=([^?&]+)/);
    if (watchMatch) {
      videoId = watchMatch[1];
    }

    // youtube.com/embed/VIDEO_ID
    const embedMatch = trimmedUrl.match(/\/embed\/([^?&]+)/);
    if (embedMatch) {
      videoId = embedMatch[1];
    }

    // youtube.com/shorts/VIDEO_ID
    const shortsMatch = trimmedUrl.match(/\/shorts\/([^?&]+)/);
    if (shortsMatch) {
      videoId = shortsMatch[1];
    }

    // If we found a video ID, return normalized URL
    if (videoId) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    // If no video ID found, return original URL
    return trimmedUrl;
  } catch {
    // In case of any error, return original URL
    return url;
  }
};

/**
 * Validate news/article URL
 * @param url - The URL to validate
 * @returns Object with valid flag and optional error message
 */
export const validateNewsUrl = (url: string): { valid: boolean; error?: string } => {
  if (!url.trim()) {
    return { valid: false, error: 'Моля, въведете URL' };
  }

  try {
    const urlObj = new URL(url.trim());

    // Check if it's a valid HTTP/HTTPS URL
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'URL трябва да започва с http:// или https://' };
    }

    // Check if it has a hostname
    if (!urlObj.hostname) {
      return { valid: false, error: 'Невалиден URL формат' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Невалиден URL формат. Моля, въведете валиден URL адрес.' };
  }
};
