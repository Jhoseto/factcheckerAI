/**
 * Points Conversion Utility
 * 
 * Conversion rate: €1 = 100 points
 * User markup: 2x Gemini API cost
 */

/**
 * Convert EUR to points with 2x markup
 * @param eurAmount - Amount in EUR (Gemini cost)
 * @returns Points to charge user (2x markup applied)
 */
export function eurToPoints(eurAmount: number): number {
    // €1 = 100 points, 2x markup
    return Math.ceil(eurAmount * 100 * 2);
}

/**
 * Convert points back to EUR (for internal calculations)
 * @param points - Number of points
 * @returns EUR amount
 */
export function pointsToEur(points: number): number {
    // Reverse: points / 100 / 2
    return points / 100 / 2;
}

/**
 * Format points for display to user
 * @param points - Number of points
 * @returns Formatted string
 */
export function formatPoints(points: number): string {
    return `${points.toLocaleString('bg-BG')} точки`;
}

/**
 * Convert USD to points with 2x markup
 * (Gemini pricing is in USD)
 * @param usdAmount - Amount in USD
 * @returns Points to charge user
 */
export function usdToPoints(usdAmount: number): number {
    // Approximate USD to EUR conversion (1.08 rate)
    // Then apply €1 = 100 points + 2x markup
    const eurAmount = usdAmount * 0.93; // USD to EUR
    return Math.ceil(eurAmount * 100 * 2);
}
