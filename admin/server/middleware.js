/**
 * Admin middleware — verify JWT and admin/super-admin claims
 */
import admin from 'firebase-admin';
import { SUPER_ADMIN_EMAIL } from './config.js';

function getAuthHeader(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.split('Bearer ')[1];
}

/**
 * Verify token and attach decoded token to req.decodedToken, req.userId
 */
export async function requireAuth(req, res, next) {
    const idToken = getAuthHeader(req);
    if (!idToken) {
        return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.decodedToken = decodedToken;
        req.userId = decodedToken.uid;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
}

/**
 * Require admin claim. Use after requireAuth.
 */
export function requireAdmin(req, res, next) {
    if (!req.decodedToken) return res.status(401).json({ error: 'Unauthorized' });
    if (req.decodedToken.admin !== true) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
}

/**
 * Require super admin (sereliev@gmail.com or super_admin claim). Use after requireAdmin.
 */
export function requireSuperAdmin(req, res, next) {
    if (!req.decodedToken) return res.status(401).json({ error: 'Unauthorized' });
    const email = (req.decodedToken.email || '').toLowerCase();
    const isSuperAdmin = email === SUPER_ADMIN_EMAIL.toLowerCase()
        || req.decodedToken.super_admin === true;
    if (!isSuperAdmin) {
        return res.status(403).json({ error: 'Forbidden: Super admin access required' });
    }
    req.isSuperAdmin = true;
    next();
}
