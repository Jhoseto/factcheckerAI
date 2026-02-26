/**
 * Transactions API — reads from Firestore collection 'transactions'.
 *
 * How purchases get into the DB:
 * 1. Server (webhook → addPointsToUser): collection 'transactions', auto doc ID.
 *    Fields: { userId (string), type: 'purchase', amount (number), description, paymentIntentId, createdAt (ISO) }
 * 2. Client (AuthContext welcome bonus): collection 'transactions', doc ID `${uid}_welcome`.
 *    Fields: { userId (string), type: 'bonus', amount, description, createdAt (ISO) }
 *
 * Deductions: written by deductPointsFromUser with type: 'deduction', amount < 0.
 * Query: where('userId', '==', uid) — same userId string for all.
 */
import express from 'express';
import { verifyToken, getFirestore } from '../services/firebaseAdmin.js';

const router = express.Router();

/**
 * GET /api/transactions
 * Fetch user transactions (purchases, bonus, deductions) for the authenticated user.
 * Requires Authorization header with Firebase ID Token.
 */
router.get('/', async (req, res) => {
    try {
        // 1. Verify Auth Token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('[Transactions API] Missing or invalid Authorization header');
            return res.status(401).json({ error: 'Unauthorized: Missing token' });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const userId = await verifyToken(idToken);

        if (!userId) {
            console.error('[Transactions API] Token verification failed');
            return res.status(403).json({ error: 'Forbidden: Invalid token' });
        }

        const uid = String(userId).trim();
        // 2. Fetch from Firestore: collection 'transactions', query by field 'userId' (same field written by addPointsToUser and AuthContext welcome bonus)
        const db = getFirestore();
        const transactionsRef = db.collection('transactions');
        const snapshot = await transactionsRef
            .where('userId', '==', uid)
            .get();

        let transactions = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            let createdAt = data.createdAt;
            const amountNum = typeof data.amount === 'number' ? data.amount : Number(data.amount);
            let type = data.type != null ? String(data.type).toLowerCase() : '';

            if (type !== 'purchase' && type !== 'bonus' && type !== 'deduction') {
                type = !Number.isNaN(amountNum) && amountNum > 0 ? 'purchase' : 'deduction';
            }

            if (createdAt && typeof createdAt.toDate === 'function') {
                createdAt = createdAt.toDate().toISOString();
            }
            if (!createdAt && data.timestamp && typeof data.timestamp.toDate === 'function') {
                createdAt = data.timestamp.toDate().toISOString();
            }

            transactions.push({
                id: doc.id,
                ...data,
                type,
                createdAt: createdAt || new Date().toISOString()
            });
        });

        // In-memory Sort (Newest first)
        transactions.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
        });

        transactions = transactions.slice(0, 50);

        const purchaseCount = transactions.filter(t => t.type === 'purchase' || t.type === 'bonus').length;
        console.log(`[Transactions API] userId=${uid.slice(0, 8)}… total=${transactions.length} purchases/bonus=${purchaseCount}`);

        res.json({ transactions });

    } catch (error) {
        console.error('[Transactions API] Critical Error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

export default router;
