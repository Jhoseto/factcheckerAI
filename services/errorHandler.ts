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
      error.message?.includes('401') || 
      error.status === 401 ||
      error.statusCode === 401 ||
      error.code === 'API_KEY_ERROR' ||
      error.response?.status === 401) {
    return new AppError(
      'Грешка с API ключа. Моля, проверете конфигурацията в .env файла.',
      'API_KEY_ERROR',
      401,
      false
    );
  }

  // Invalid JSON
  if (error.message?.includes('JSON') || error.message?.includes('parse')) {
    return new AppError(
      'Грешка при обработка на отговора от API. Моля, опитайте отново.',
      'PARSE_ERROR',
      undefined,
      true
    );
  }

  // Default - return original error message
  return new AppError(
    error.message || 'Възникна неочаквана грешка. Моля, опитайте отново.',
    'UNKNOWN_ERROR',
    error.status || error.response?.status,
    false
  );
};
