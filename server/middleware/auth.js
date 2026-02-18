/**
 * Authentication Middleware
 * Verifies Firebase ID Token on every protected request
 */

import { verifyToken } from '../../services/firebaseAdmin.js';

/**
 * Express middleware that verifies Bearer token and attaches userId to req
 */
export async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
        const userId = await verifyToken(idToken);
        if (!userId) throw new Error('Invalid token');
        req.userId = userId;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
}
