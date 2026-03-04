/**
 * GET /api/admin/admins — List admins (super admin only)
 */
import express from 'express';
import admin from 'firebase-admin';
import { requireSuperAdmin } from '../middleware.js';
import { SUPER_ADMIN_EMAIL } from '../config.js';
import { getAdmins } from '../services/firestore.js';

const router = express.Router();

router.get('/', requireSuperAdmin, async (req, res) => {
    try {
        let admins = await getAdmins();
        try {
            const sa = await admin.auth().getUserByEmail(SUPER_ADMIN_EMAIL);
            const inList = admins.some(a => (a.uid || a.id) === sa.uid);
            if (!inList) admins = [{ uid: sa.uid, email: sa.email, promotedAt: null, role: 'super_admin' }, ...admins];
        } catch { /* super admin may not exist yet */ }
        res.json({ admins });
    } catch (e) {
        console.error('[Admin admins list]', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
