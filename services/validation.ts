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
