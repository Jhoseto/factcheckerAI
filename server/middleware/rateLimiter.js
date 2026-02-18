/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

// Simple in-memory rate limiter (for single-instance deployments)
// For multi-instance (Cloud Run), replace with Redis-based limiter

const requestCounts = new Map(); // key: userId or IP, value: { count, resetAt }

/**
 * Creates a rate limiter middleware
 * @param {number} maxRequests - Max requests per window
 * @param {number} windowMs - Window size in milliseconds
 * @param {string} keyType - 'user' (uses req.userId) or 'ip'
 */
export function createRateLimiter(maxRequests = 10, windowMs = 60000, keyType = 'user') {
    return (req, res, next) => {
        const key = keyType === 'user'
            ? (req.userId || req.ip)
            : req.ip;

        const now = Date.now();
        const record = requestCounts.get(key);

        if (!record || now > record.resetAt) {
            // New window
            requestCounts.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        if (record.count >= maxRequests) {
            const retryAfter = Math.ceil((record.resetAt - now) / 1000);
            res.setHeader('Retry-After', retryAfter);
            return res.status(429).json({
                error: `Твърде много заявки. Моля, изчакайте ${retryAfter} секунди.`,
                code: 'RATE_LIMIT',
                retryAfter
            });
        }

        record.count++;
        next();
    };
}

// Cleanup old entries every 5 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requestCounts.entries()) {
        if (now > record.resetAt) {
            requestCounts.delete(key);
        }
    }
}, 5 * 60 * 1000);

// Pre-configured limiters
export const analysisRateLimiter = createRateLimiter(10, 60000, 'user');   // 10 analyses/min per user
export const globalRateLimiter = createRateLimiter(100, 60000, 'ip');       // 100 req/min per IP
