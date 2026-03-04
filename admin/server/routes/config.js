/**
 * GET /api/admin/config — Read config (super admin only)
 * PUT /api/admin/config — Update config (super admin only)
 * GET /api/admin/config/public — Public: announcement only (no auth)
 */
import express from 'express';
import { requireSuperAdmin } from '../middleware.js';
import { getDb } from '../services/firestore.js';

const router = express.Router();

router.get('/', requireSuperAdmin, async (req, res) => {
    try {
        const db = getDb();
        const doc = await db.collection('config').doc('main').get();
        const data = doc.exists ? doc.data() : {};
        res.json(data);
    } catch (e) {
        console.error('[Admin config]', e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/', requireSuperAdmin, express.json(), async (req, res) => {
    try {
        const db = getDb();
        const updates = req.body || {};
        const allowed = ['maintenanceMode', 'newRegistrationEnabled', 'maxAnalysesPerDay', 'announcement'];
        const toSet = {};
        for (const k of allowed) {
            if (updates[k] !== undefined) toSet[k] = updates[k];
        }
        if (Object.keys(toSet).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
        toSet.updatedAt = new Date().toISOString();
        await db.collection('config').doc('main').set(toSet, { merge: true });
        const doc = await db.collection('config').doc('main').get();
        res.json(doc.exists ? doc.data() : {});
    } catch (e) {
        console.error('[Admin config put]', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
