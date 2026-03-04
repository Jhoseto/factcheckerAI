/**
 * GET /api/admin/transactions — Global transactions list
 */
import express from 'express';
import { requireAdmin } from '../middleware.js';
import { getTransactions } from '../services/firestore.js';

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 100;
        const type = (req.query.type || '').trim();
        const transactions = await getTransactions(limit, type || undefined);
        res.json({ transactions });
    } catch (e) {
        console.error('[Admin transactions]', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
