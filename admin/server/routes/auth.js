/**
 * GET /api/admin/verify — Check if current user is admin (for UI)
 */
import express from 'express';
import { requireAuth, requireAdmin } from '../middleware.js';
import { SUPER_ADMIN_EMAIL } from '../config.js';

const router = express.Router();

router.get('/verify', requireAuth, (req, res) => {
    if (req.decodedToken.admin !== true) {
        return res.status(403).json({ ok: false });
    }
    const email = (req.decodedToken.email || '').toLowerCase();
    const isSuperAdmin = email === SUPER_ADMIN_EMAIL.toLowerCase()
        || req.decodedToken.super_admin === true;
    res.json({ ok: true, isSuperAdmin });
});

export default router;
