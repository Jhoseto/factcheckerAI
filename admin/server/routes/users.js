/**
 * GET /api/admin/users — List users
 * GET /api/admin/users/:uid — User detail + transactions + analyses
 * POST /api/admin/users/:uid/points — Add/deduct points
 * POST /api/admin/users/:uid/promote — Promote to admin (super admin only)
 * POST /api/admin/users/:uid/demote — Demote from admin (super admin only)
 */
import express from 'express';
import admin from 'firebase-admin';
import { requireAdmin, requireSuperAdmin } from '../middleware.js';
import { SUPER_ADMIN_EMAIL } from '../config.js';
import { getUsers, getUser, getUserTransactions, getUserAnalyses, addAdmin, removeAdmin } from '../services/firestore.js';
import { addPointsToUser, deductPointsFromUser } from '../../../server/services/firebaseAdmin.js';

const router = express.Router();

router.post('/promote-by-email', requireSuperAdmin, async (req, res) => {
    try {
        const { email } = req.body || {};
        const em = (email || '').trim().toLowerCase();
        if (!em) return res.status(400).json({ error: 'Email required' });
        const userRecord = await admin.auth().getUserByEmail(em);
        if (!userRecord) return res.status(404).json({ error: 'User not found' });
        const uid = userRecord.uid;
        if (uid === req.userId) return res.status(400).json({ error: 'Cannot promote yourself' });
        if (em === SUPER_ADMIN_EMAIL.toLowerCase()) return res.status(400).json({ error: 'User is already super admin' });
        await admin.auth().setCustomUserClaims(uid, { admin: true });
        await addAdmin(uid, userRecord.email, req.userId);
        res.json({ success: true, message: 'User promoted to admin', uid });
    } catch (e) {
        console.error('[Admin promote-by-email]', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/', requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        const q = (req.query.q || '').trim();
        const users = await getUsers(limit, null, q);
        res.json({ users });
    } catch (e) {
        console.error('[Admin users]', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/:uid', requireAdmin, async (req, res) => {
    try {
        const { uid } = req.params;
        const [user, transactions, analyses, authRecord] = await Promise.all([
            getUser(uid),
            getUserTransactions(uid),
            getUserAnalyses(uid),
            admin.auth().getUser(uid).catch(() => null)
        ]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const customClaims = authRecord?.customClaims || {};
        const isAdmin = !!customClaims.admin;
        const isSuperAdminUser = (authRecord?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() || !!customClaims.super_admin;
        const disabled = !!authRecord?.disabled;
        const photoURL = user.photoURL || authRecord?.photoURL || null;
        const viewerEmail = (req.decodedToken?.email || '').toLowerCase();
        const isSuperAdmin = viewerEmail === SUPER_ADMIN_EMAIL.toLowerCase() || !!req.decodedToken?.super_admin;
        res.json({ user: { ...user, photoURL, disabled }, transactions, analyses, isAdmin, isSuperAdminUser, isSuperAdmin });
    } catch (e) {
        console.error('[Admin user detail]', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/:uid/points', requireAdmin, async (req, res) => {
    try {
        const { uid } = req.params;
        const { amount, reason } = req.body || {};
        const points = parseInt(amount, 10);
        if (isNaN(points) || points === 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        const description = (reason || 'Admin adjustment').trim() || 'Admin adjustment';

        if (points > 0) {
            await addPointsToUser(uid, points, null, { type: 'bonus', source: 'manual', description: description });
            res.json({ success: true, action: 'add', points });
        } else {
            const result = await deductPointsFromUser(uid, Math.abs(points), description);
            if (!result.success) {
                return res.status(400).json({ error: 'Insufficient points', newBalance: result.newBalance });
            }
            res.json({ success: true, action: 'deduct', points: Math.abs(points), newBalance: result.newBalance });
        }
    } catch (e) {
        console.error('[Admin points]', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/:uid/promote', requireSuperAdmin, async (req, res) => {
    try {
        const { uid } = req.params;
        if (uid === req.userId) return res.status(400).json({ error: 'Cannot promote yourself' });
        const userRecord = await admin.auth().getUser(uid);
        const email = (userRecord.email || '').toLowerCase();
        if (email === SUPER_ADMIN_EMAIL.toLowerCase()) return res.status(400).json({ error: 'User is already super admin' });
        await admin.auth().setCustomUserClaims(uid, { admin: true });
        await addAdmin(uid, userRecord.email, req.userId);
        res.json({ success: true, message: 'User promoted to admin' });
    } catch (e) {
        console.error('[Admin promote]', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/:uid/block', requireSuperAdmin, async (req, res) => {
    try {
        const { uid } = req.params;
        if (uid === req.userId) return res.status(400).json({ error: 'Cannot block yourself' });
        const userRecord = await admin.auth().getUser(uid);
        const email = (userRecord.email || '').toLowerCase();
        if (email === SUPER_ADMIN_EMAIL.toLowerCase()) return res.status(400).json({ error: 'Cannot block super admin' });
        await admin.auth().updateUser(uid, { disabled: true });
        res.json({ success: true, message: 'User blocked' });
    } catch (e) {
        console.error('[Admin block]', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/:uid/unblock', requireSuperAdmin, async (req, res) => {
    try {
        const { uid } = req.params;
        await admin.auth().updateUser(uid, { disabled: false });
        res.json({ success: true, message: 'User unblocked' });
    } catch (e) {
        console.error('[Admin unblock]', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/:uid/demote', requireSuperAdmin, async (req, res) => {
    try {
        const { uid } = req.params;
        if (uid === req.userId) return res.status(400).json({ error: 'Cannot demote yourself' });
        const userRecord = await admin.auth().getUser(uid);
        const email = (userRecord.email || '').toLowerCase();
        if (email === SUPER_ADMIN_EMAIL.toLowerCase()) return res.status(400).json({ error: 'Cannot demote super admin' });
        await admin.auth().setCustomUserClaims(uid, { admin: false });
        await removeAdmin(uid);
        res.json({ success: true, message: 'User demoted from admin' });
    } catch (e) {
        console.error('[Admin demote]', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
