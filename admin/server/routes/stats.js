/**
 * GET /api/admin/stats — Aggregated metrics
 */
import express from 'express';
import { requireAdmin } from '../middleware.js';
import { getStats } from '../services/firestore.js';

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
    try {
        const stats = await getStats();
        res.json(stats);
    } catch (e) {
        console.error('[Admin stats]', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
