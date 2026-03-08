/**
 * GET /api/admin/verify — Check if current user is admin (for UI)
 */
import express from 'express';
import { requireAuth, requireAdmin } from '../middleware.js';
import { SUPER_ADMIN_EMAIL } from '../config.js';

const router = express.Router();

router.get('/verify', requireAuth, (req, res) => {
    const email = (req.decodedToken.email || '').toLowerCase();
    const isAdmin = req.decodedToken.admin === true || email === SUPER_ADMIN_EMAIL.toLowerCase();

    if (!isAdmin) {
        return res.json({ ok: false });
    }

    const isSuperAdmin = email === SUPER_ADMIN_EMAIL.toLowerCase()
        || req.decodedToken.super_admin === true;
    res.json({ ok: true, isSuperAdmin });
});

export default router;
