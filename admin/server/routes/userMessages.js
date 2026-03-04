/**
 * Admin: CRUD for user_messages
 * GET /api/admin/user-messages — List all
 * POST /api/admin/user-messages — Create
 * PUT /api/admin/user-messages/:id — Update
 * DELETE /api/admin/user-messages/:id — Delete
 */
import express from 'express';
import { requireSuperAdmin } from '../middleware.js';
import { getDb } from '../services/firestore.js';

const router = express.Router();

function toIso(val) {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val?.toDate) return val.toDate().toISOString();
    return '';
}

router.get('/', requireSuperAdmin, async (req, res) => {
    try {
        const db = getDb();
        const snapshot = await db.collection('user_messages').orderBy('createdAt', 'desc').get();
        const list = snapshot.docs.map(d => {
            const data = d.data();
            return { id: d.id, ...data, createdAt: toIso(data.createdAt), until: toIso(data.until) };
        });
        res.json({ messages: list });
    } catch (e) {
        console.error('[Admin user-messages]', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/', requireSuperAdmin, express.json(), async (req, res) => {
    try {
        const { message, userIds, enabled, until } = req.body || {};
        const text = (message || '').trim();
        if (!text) return res.status(400).json({ error: 'Message required' });
        let targets;
        if (userIds === 'all' || userIds === 'ALL') targets = 'all';
        else if (Array.isArray(userIds)) targets = userIds;
        else if (typeof userIds === 'string') targets = userIds.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
        else targets = [];
        if (targets !== 'all' && (!Array.isArray(targets) || targets.length === 0)) {
            return res.status(400).json({ error: 'userIds must be array of UIDs or "all"' });
        }
        const db = getDb();
        const doc = {
            message: text,
            userIds: targets,
            enabled: !!enabled,
            until: until ? new Date(until) : null,
            createdAt: new Date().toISOString()
        };
        const ref = await db.collection('user_messages').add(doc);
        res.json({ id: ref.id, ...doc });
    } catch (e) {
        console.error('[Admin user-messages create]', e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/:id', requireSuperAdmin, express.json(), async (req, res) => {
    try {
        const { id } = req.params;
        const { message, userIds, enabled, until } = req.body || {};
        const db = getDb();
        const ref = db.collection('user_messages').doc(id);
        const doc = await ref.get();
        if (!doc.exists) return res.status(404).json({ error: 'Not found' });
        const updates = {};
        if (message !== undefined) updates.message = String(message).trim();
        if (userIds !== undefined) updates.userIds = (userIds === 'all' || userIds === 'ALL') ? 'all' : (Array.isArray(userIds) ? userIds : []);
        if (enabled !== undefined) updates.enabled = !!enabled;
        if (until !== undefined) updates.until = until ? new Date(until) : null;
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields' });
        await ref.update(updates);
        const updated = await ref.get();
        res.json({ id, ...updated.data() });
    } catch (e) {
        console.error('[Admin user-messages update]', e);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDb();
        await db.collection('user_messages').doc(id).delete();
        res.json({ success: true });
    } catch (e) {
        console.error('[Admin user-messages delete]', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
