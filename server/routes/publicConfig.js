/**
 * Public config endpoints (no auth)
 * GET /api/config/public — maintenanceMode, newRegistrationEnabled, announcement
 * GET /api/config/announcement — announcement only (legacy)
 */
import express from 'express';
import { getFirestore } from '../services/firebaseAdmin.js';

const router = express.Router();

async function getConfig() {
    const db = getFirestore();
    const doc = await db.collection('config').doc('main').get();
    return doc.exists ? doc.data() : {};
}

router.get('/public', async (req, res) => {
    try {
        const data = await getConfig();
        const ann = data.announcement || {};
        res.json({
            maintenanceMode: !!data.maintenanceMode,
            newRegistrationEnabled: data.newRegistrationEnabled !== false,
            maxAnalysesPerDay: data.maxAnalysesPerDay ?? null,
            announcement: (ann.enabled && ann.text) ? { text: ann.text, until: ann.until } : null
        });
    } catch {
        res.json({ maintenanceMode: false, newRegistrationEnabled: true, announcement: null });
    }
});

router.get('/announcement', async (req, res) => {
    try {
        const data = await getConfig();
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
