/**
 * Firebase Admin SDK Service
 * Server-side Firebase operations for secure points management
 *
 * ВАЖНО: Всички операции с точки използват полето `pointsBalance` в Firestore.
 * Не се използва `points` — само `pointsBalance`.
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let adminInitialized = false;

export function initializeFirebaseAdmin() {
    if (adminInitialized) return true;

    try {
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
        const absolutePath = path.resolve(__dirname, '..', serviceAccountPath);

        let serviceAccount;
        try {
            serviceAccount = JSON.parse(readFileSync(absolutePath, 'utf8'));
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        } catch (fileError) {
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE) {
                console.log('[Firebase Admin] File not found, trying default credentials...');
                admin.initializeApp();
            } else {
                throw fileError;
            }
        }

        adminInitialized = true;
        console.log('[Firebase Admin] ✅ Initialized successfully');
        return true;
    } catch (error) {
        console.warn('[Firebase Admin] ⚠️  Not initialized:', error.message);
        return false;
    }
}

function getFirestore() {
    if (!adminInitialized) initializeFirebaseAdmin();
    return admin.firestore();
}

/**
 * Verify Firebase ID Token
 */
export async function verifyToken(idToken) {
    if (!adminInitialized) {
        const success = initializeFirebaseAdmin();
        if (!success) return null;
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        console.error('[Firebase Admin] Token verification failed:', error.message);
        return null;
    }
}

/**
 * Get user points balance
 * Reads from `pointsBalance` field (canonical field name)
 */
export async function getUserPoints(userId) {
    try {
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return 0;
        return userDoc.data()?.pointsBalance || 0;
    } catch (error) {
        console.error('[Firebase Admin] ❌ Failed to get user points:', error.message);
        return 0;
    }
}

/**
 * Deduct points from user account (server-side, atomic)
 * Uses `pointsBalance` field exclusively.
 * Returns { success: boolean, newBalance: number }
 */
export async function deductPointsFromUser(userId, points) {
    try {
        const db = getFirestore();
        const userRef = db.collection('users').doc(userId);

        const result = await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error(`User ${userId} not found`);

            const currentBalance = userDoc.data()?.pointsBalance || 0;
            if (currentBalance < points) {
                return { success: false, newBalance: currentBalance };
            }

            const newBalance = currentBalance - points;
            transaction.update(userRef, {
                pointsBalance: newBalance,
                lastPointsUpdate: admin.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, newBalance };
        });

        if (result.success) {
            console.log(`[Firebase Admin] ✅ Deducted ${points} points from user ${userId}. New balance: ${result.newBalance}`);
        } else {
            console.log(`[Firebase Admin] ❌ Insufficient points for user ${userId}`);
        }

        return result;
    } catch (error) {
        console.error('[Firebase Admin] ❌ Failed to deduct points:', error.message);
        throw error;
    }
}

/**
 * Add points to user account (after purchase)
 * Uses `pointsBalance` field exclusively.
 * Idempotent: checks processedOrders to prevent double-crediting.
 */
export async function addPointsToUser(userId, points, orderId = null) {
    if (!adminInitialized) {
        console.warn('[Firebase Admin] ⚠️  Cannot add points - not initialized');
        return;
    }

    try {
        const db = getFirestore();
        const userRef = db.collection('users').doc(userId);

        await db.runTransaction(async (transaction) => {
            // ── Idempotency check ──────────────────────────────────────────────
            if (orderId) {
                const orderRef = db.collection('processedOrders').doc(orderId);
                const orderDoc = await transaction.get(orderRef);
                if (orderDoc.exists) {
                    console.log(`[Firebase Admin] ⚠️  Order ${orderId} already processed. Skipping.`);
                    return; // Already processed — do nothing
                }
                // Mark order as processed
                transaction.set(orderRef, {
                    userId,
                    points,
                    processedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            // ── Add points ────────────────────────────────────────────────────
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                throw new Error(`User ${userId} not found in Firestore`);
            }

            const currentBalance = userDoc.data()?.pointsBalance || 0;
            const newBalance = currentBalance + points;

            transaction.update(userRef, {
                pointsBalance: newBalance,
                lastPointsUpdate: admin.firestore.FieldValue.serverTimestamp()
            });

            // ── Record transaction ────────────────────────────────────────────
            const transactionId = orderId || `${userId}_${Date.now()}`;
            const transactionRef = db.collection('transactions').doc(transactionId);
            transaction.set(transactionRef, {
                userId,
                type: 'purchase',
                amount: points,
                description: `Зареждане на ${points} точки`,
                orderId: orderId || null,
                createdAt: new Date().toISOString()
            });
        });

        console.log(`[Firebase Admin] ✅ Added ${points} points to user ${userId}`);
    } catch (error) {
        console.error('[Firebase Admin] ❌ Failed to add points:', error.message);
        throw error;
    }
}

/**
 * Record analysis transaction (called after successful analysis + deduction)
 */
export async function recordAnalysisTransaction(userId, points, analysisId, metadata = {}) {
    try {
        const db = getFirestore();
        const transactionId = `${userId}_${analysisId}`;
        await db.collection('transactions').doc(transactionId).set({
            userId,
            type: 'deduction',
            amount: -points,
            description: metadata.videoTitle
                ? `Анализ: ${metadata.videoTitle.substring(0, 50)}`
                : `Анализ #${analysisId}`,
            analysisId,
            metadata: metadata || null,
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        // Non-critical — log but don't throw
        console.error('[Firebase Admin] ⚠️  Failed to record transaction:', error.message);
    }
}
