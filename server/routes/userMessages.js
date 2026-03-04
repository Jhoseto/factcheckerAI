/**
 * GET /api/user-messages — Messages for current user (auth required)
 */
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getFirestore } from '../services/firebaseAdmin.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const db = getFirestore();
        const snapshot = await db.collection('user_messages').where('enabled', '==', true).get();
        const now = new Date().toISOString();
        const messages = [];
        snapshot.docs.forEach(d => {
            const data = d.data();
            const until = data.until?.toDate?.()?.toISOString?.() || data.until;
            if (until && until < now) return;
            const targets = data.userIds;
            if (targets === 'all' || (Array.isArray(targets) && targets.includes(userId))) {
                messages.push({ id: d.id, message: data.message, until: until || null });
            }
        });
        res.json({ messages });
    } catch (e) {
        console.error('[User messages]', e);
        res.json({ messages: [] });
    }
});

export default router;
