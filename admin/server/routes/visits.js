/**
 * GET /api/admin/visits — Visit log with filters
 */
import express from 'express';
import { requireAdmin } from '../middleware.js';
import { getVisits } from '../services/firestore.js';

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
    try {
        const filters = {
            ip: (req.query.ip || '').trim() || undefined,
            userId: (req.query.userId || '').trim() || undefined,
            action: (req.query.action || '').trim() || undefined,
            from: (req.query.from || '').trim() || undefined,
            to: (req.query.to || '').trim() || undefined,
            limit: parseInt(req.query.limit, 10) || 100
        };
        const visits = await getVisits(filters);
        res.json({ visits });
    } catch (e) {
        console.error('[Admin visits]', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
