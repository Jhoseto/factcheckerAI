/**
 * Centralized error handling utilities
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Handle API errors and convert them to user-friendly AppError
 */
export const handleApiError = (error: any): AppError => {
  // Rate limit (429)
  if (error.message?.includes('429') || error.status === 429 || error.response?.status === 429) {
    return new AppError(
      'Превишена е квотата за заявки. Моля, изчакайте 1-2 минути преди следващата заявка.',
      'RATE_LIMIT',
      429,
      true
    );
  }

  // Network error
  if (error.message?.includes('fetch') ||
    error.message?.includes('network') ||
    error.message?.includes('Failed to fetch') ||
    error.name === 'TypeError') {
    return new AppError(
      'Проблем с мрежовата връзка. Моля, проверете интернет връзката си и опитайте отново.',
      'NETWORK_ERROR',
      undefined,
      true
    );
  }

  // API key error (401)
  if (error.message?.includes('API key') ||
    error.message?.includes('api key') ||
    error.message?.includes('API_KEY') ||
    error.message?.includes('Invalid or missing API key') ||
    error.message?.includes('authentication') ||
    error.statusCode === 401 ||
    error.code === 'API_KEY_ERROR' ||
    error.response?.status === 401) {
    console.error('[API Error] Authentication/API Key issue:', error);
    return new AppError(
      'Възникна техническа грешка при връзката със сървъра. Моля, свържете се с поддръжката.',
      'API_KEY_ERROR',
      401,
      false
    );
  }

  // Insufficient Points (403)
  if (error.status === 403 ||
    error.statusCode === 403 ||
    error.response?.status === 403 ||
    error.message?.includes('Insufficient points') ||
    error.code === 'INSUFFICIENT_POINTS') {
    return new AppError(
      'Недостатъчно точки за анализ.',
      'INSUFFICIENT_POINTS',
      403,
      false
    );
  }

  // Invalid JSON
  if (error.message?.includes('JSON') || error.message?.includes('parse')) {
    return new AppError(
      'Възникна техническа грешка при обработка на данните. Моля, опитайте отново.',
      'PARSE_ERROR',
      undefined,
      true
    );
  }

  // Default - return original error message
  console.error('[App Error] Unknown error:', error);
  return new AppError(
    'Възникна неочаквана грешка. Моля, опитайте отново по-късно.',
    'UNKNOWN_ERROR',
    error.status || error.response?.status,
    false
  );
};
