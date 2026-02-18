
import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyToken } from '../services/firebaseAdmin.js';

const router = express.Router();

/**
 * GET /api/transactions
 * Fetch user transactions
 * Requires Authorization header with Firebase ID Token
 */
router.get('/', async (req, res) => {
    try {
        // 1. Verify Auth Token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing token' });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const userId = await verifyToken(idToken);

        if (!userId) {
            return res.status(403).json({ error: 'Forbidden: Invalid token' });
        }

        // 2. Fetch Transactions from Firestore (Admin SDK)
        const db = getFirestore();
        const transactionsRef = db.collection('transactions');

        // Query: where userId == userId
        // Ordering by createdAt desc
        // Limit 50 (can be parameterized)

        const snapshot = await transactionsRef
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const transactions = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Handle Timestamp conversion if necessary (robustness)
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                data.createdAt = data.createdAt.toDate().toISOString();
            }

            transactions.push({
                id: doc.id,
                ...data
            });
        });

        res.json({ transactions });

    } catch (error) {
        console.error('[Transactions API] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
