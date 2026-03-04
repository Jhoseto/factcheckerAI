/**
 * GET /api/config/announcement — Public: returns announcement if enabled
 */
import express from 'express';
import { getFirestore } from '../services/firebaseAdmin.js';

const router = express.Router();

router.get('/announcement', async (req, res) => {
    try {
        const db = getFirestore();
        const doc = await db.collection('config').doc('main').get();
        const data = doc.exists ? doc.data() : {};
        const ann = data.announcement || {};
        if (ann.enabled && ann.text) {
            res.json({ announcement: { text: ann.text, until: ann.until } });
        } else {
            res.json({ announcement: null });
        }
    } catch {
        res.json({ announcement: null });
    }
});

export default router;
