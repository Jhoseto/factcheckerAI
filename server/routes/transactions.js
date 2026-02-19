
import express from 'express';
import { verifyToken, getFirestore } from '../services/firebaseAdmin.js';

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
            console.error('[Transactions API] Missing or invalid Authorization header');
            return res.status(401).json({ error: 'Unauthorized: Missing token' });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const userId = await verifyToken(idToken);

        if (!userId) {
            console.error('[Transactions API] Token verification failed');
            return res.status(403).json({ error: 'Forbidden: Invalid token' });
        }

        // 2. Fetch Transactions from Firestore (Admin SDK)
        // Uses safe getFirestore from service which ensures initialization
        const db = getFirestore();
        const transactionsRef = db.collection('transactions');

        // Query: where userId == userId
        // NOTE: We do NOT use orderBy/limit here to avoid "Missing Index" errors (500).
        // Sorting and limiting is done in-memory.
        const snapshot = await transactionsRef
            .where('userId', '==', userId)
            .get();


        let transactions = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            let createdAt = data.createdAt;

            // Handle Firestore Timestamp
            if (createdAt && typeof createdAt.toDate === 'function') {
                createdAt = createdAt.toDate().toISOString();
            }
            // Handle timestamp field if createdAt is missing
            if (!createdAt && data.timestamp && typeof data.timestamp.toDate === 'function') {
                createdAt = data.timestamp.toDate().toISOString();
            }

            transactions.push({
                id: doc.id,
                ...data,
                createdAt: createdAt || new Date().toISOString() // Fallback
            });
        });

        // In-memory Sort (Newest first)
        transactions.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
        });

        // In-memory Limit
        transactions = transactions.slice(0, 50);

        res.json({ transactions });

    } catch (error) {
        console.error('[Transactions API] Critical Error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

export default router;
