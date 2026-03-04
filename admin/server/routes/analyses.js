/**
 * GET /api/admin/analyses — Aggregated analyses data
 * GET /api/admin/analyses/list — Last 50–100 analyses with report links
 */
import express from 'express';
import { requireAdmin } from '../middleware.js';
import { getAnalysesAggregation, getAnalysesList } from '../services/firestore.js';

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
    try {
        const days = parseInt(req.query.days, 10) || 7;
        const data = await getAnalysesAggregation(days);
        res.json(data);
    } catch (e) {
        console.error('[Admin analyses]', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/list', requireAdmin, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 100);
        const list = await getAnalysesList(limit);
        res.json(list);
    } catch (e) {
        console.error('[Admin analyses list]', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
