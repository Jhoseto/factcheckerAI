/**
 * GET /api/admin/activity/recent — Last 10 transactions and analyses
 * GET /api/admin/activity — Activity log (analysis_video, analysis_link, etc.)
 */
import express from 'express';
import { requireAdmin } from '../middleware.js';
import { getTransactions, getRecentAnalyses, getActivityLog } from '../services/firestore.js';

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
    try {
        const filters = {
            userId: (req.query.userId || '').trim() || undefined,
            action: (req.query.action || '').trim() || undefined,
            from: (req.query.from || '').trim() || undefined,
            to: (req.query.to || '').trim() || undefined,
            limit: parseInt(req.query.limit, 10) || 100
        };
        const activities = await getActivityLog(filters);
        res.json({ activities });
    } catch (e) {
        console.error('[Admin activity]', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/recent', requireAdmin, async (req, res) => {
    try {
        const [transactions, analyses] = await Promise.all([
            getTransactions(10, ''),
            getRecentAnalyses(10)
        ]);
        res.json({ transactions, analyses });
    } catch (e) {
        console.error('[Admin activity recent]', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
