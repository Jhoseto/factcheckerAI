/**
 * POST /api/track/visit — Log page view or login (public, rate limited)
 */
import express from 'express';
import { getFirestore } from '../services/firebaseAdmin.js';
import { verifyToken } from '../services/firebaseAdmin.js';

const router = express.Router();
const rateLimitMap = new Map(); // ip -> last timestamp
const RATE_MS = 5000; // 5 sec — allow normal navigation, React Strict Mode double-mount

function getIp(req) {
    const cf = req.headers['cf-connecting-ip']?.trim();
    if (cf) return cf;
    const real = req.headers['x-real-ip']?.trim();
    if (real) return real;
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ips = forwarded.split(',').map(s => s.trim()).filter(Boolean);
        const ipv4 = ips.find(ip => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip));
        if (ipv4) return ipv4;
        return ips[0] || '';
    }
    const raw = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
    if (raw.startsWith('::ffff:')) return raw.replace(/^::ffff:/, '');
    return raw;
}

router.post('/visit', express.json(), async (req, res) => {
    try {
        const ip = getIp(req);
        const now = Date.now();
        const last = rateLimitMap.get(ip) || 0;
        if (now - last < RATE_MS) {
            return res.status(429).json({ ok: false, retryAfter: Math.ceil(RATE_MS / 1000) });
        }
        rateLimitMap.set(ip, now);

        const { path, action } = req.body || {};
        const userAgent = req.headers['user-agent'] || '';
        const act = ['page_view', 'login'].includes(action) ? action : 'page_view';
        const pathStr = typeof path === 'string' ? path.slice(0, 200) : '/';

        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            userId = await verifyToken(token);
        }

        const db = getFirestore();
        await db.collection('visit_log').add({
            ip,
            userId: userId || null,
            path: pathStr,
            userAgent: userAgent.slice(0, 500),
            action: act,
            timestamp: new Date().toISOString()
        });

        res.json({ ok: true });
    } catch (e) {
        console.error('[VisitTrack]', e);
        res.status(500).json({ ok: false });
    }
});

export default router;
