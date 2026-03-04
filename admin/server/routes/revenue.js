/**
 * GET /api/admin/revenue — Revenue from purchases
 */
import express from 'express';
import { requireAdmin } from '../middleware.js';
import { getRevenue } from '../services/firestore.js';

const POINTS_PER_EUR = 100;

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
    try {
        const filters = {
            from: (req.query.from || '').trim() || undefined,
            to: (req.query.to || '').trim() || undefined
        };
        const data = await getRevenue(filters);
        const totalEur = (data.totalPoints || 0) / POINTS_PER_EUR;
        res.json({
            ...data,
            totalEur: Math.round(totalEur * 100) / 100,
            byMonthEur: Object.fromEntries(
                Object.entries(data.byMonth || {}).map(([k, v]) => [k, Math.round((v / POINTS_PER_EUR) * 100) / 100])
            )
        });
    } catch (e) {
        console.error('[Admin revenue]', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
