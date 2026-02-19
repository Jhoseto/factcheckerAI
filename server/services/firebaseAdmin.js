/**
 * Firebase Admin SDK Service
 * Server-side Firebase operations for secure points management
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
let adminInitialized = false;

export function initializeFirebaseAdmin() {
    if (adminInitialized) {
        return true;
    }

    try {
        // Try to load service account from file
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
        const absolutePath = path.resolve(__dirname, '../../firebase-service-account.json');

        // If GOOGLE_APPLICATION_CREDENTIALS is set (Cloud Run), let Firebase Admin usage default auth
        // BUT we need to call initializeApp() anyway.
        // Check if file exists first.
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(readFileSync(absolutePath, 'utf8'));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } catch (fileError) {
            // File not found. Check if default credentials work (Cloud Run).
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE) {
                console.log('[Firebase Admin] File not found, trying default credentials...');
                admin.initializeApp(); // Use Default Application Credentials
            } else {
                throw fileError;
            }
        }

        adminInitialized = true;
        console.log('[Firebase Admin] ✅ Initialized successfully');
        return true;
    } catch (error) {
        console.warn('[Firebase Admin] ⚠️  Not initialized:', error.message);
        console.warn('[Firebase Admin] Points crediting will NOT work until service account is configured');
        console.warn('[Firebase Admin] See FIREBASE_SETUP.md for instructions');
        return false;
    }
}

/**
 * Get Firestore instance
 */
export function getFirestore() {
    if (!adminInitialized) {
        initializeFirebaseAdmin();
    }
    return admin.firestore();
}

/**
 * Verify Firebase ID Token
 * @param idToken - Firebase ID Token
 * @returns User UID or null
 */
export async function verifyToken(idToken) {
    if (!adminInitialized) {
        const success = initializeFirebaseAdmin();
        if (!success) {
            console.error('[Firebase Admin] Cannot verify token: Admin not initialized');
            return null;
        }
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        console.error('[Firebase Admin] Token verification failed:', error);
        return null;
    }
}

/**
 * Add points to user account
 * @param userId - Firebase user UID
 * @param points - Number of points to add
 */
export async function addPointsToUser(userId, points) {
    if (!adminInitialized) {
        console.warn('[Firebase Admin] ⚠️  Cannot add points - not initialized');
        return;
    }

    try {
        const db = getFirestore();
        const userRef = db.collection('users').doc(userId);

        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new Error(`User ${userId} not found in Firestore`);
            }

            const currentPoints = userDoc.data()?.pointsBalance || 0;
            const newPoints = currentPoints + points;

            transaction.update(userRef, {
                pointsBalance: newPoints,
                lastPointsUpdate: admin.firestore.FieldValue.serverTimestamp()
            });

            // Record transaction in history
            const transactionId = `${userId}_${Date.now()}`;
            const transactionRef = db.collection('transactions').doc(transactionId);
            transaction.set(transactionRef, {
                userId: userId,
                type: 'purchase',
                amount: points,
                description: `Зареждане на ${points} точки`,
                createdAt: new Date().toISOString()
            });
        });

        console.log(`[Firebase Admin] ✅ Added ${points} points to user ${userId}`);
    } catch (error) {
        console.error(`[Firebase Admin] ❌ Failed to add points:`, error);
        throw error;
    }
}

/**
 * Deduct points from user account
 * @param userId - Firebase user UID
 * @param points - Number of points to deduct
 * @returns Object with success status and new balance
 */
export async function deductPointsFromUser(userId, points, description = 'Използване на услуги', metadata = {}) {
    console.log(`[Firebase Admin] deductPointsFromUser called: userId=${userId}, points=${points}, desc=${description}`);
    try {
        const db = getFirestore();
        const userRef = db.collection('users').doc(userId);
        const transactionRef = db.collection('transactions').doc(); // Auto-ID

        const result = await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new Error(`User ${userId} not found in Firestore`);
            }

            const currentPoints = userDoc.data()?.pointsBalance || 0;

            if (currentPoints < points) {
                console.log(`[Firebase Admin] ❌ Insufficient points for user ${userId}: has ${currentPoints}, needs ${points}`);
                // Return explicit failure object instead of throwing, to handle gracefully
                return { success: false, newBalance: currentPoints, error: 'insufficient_points' };
            }

            const newPoints = currentPoints - points;

            // 1. Update User Balance
            transaction.update(userRef, {
                pointsBalance: newPoints,
                lastPointsUpdate: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. Create Transaction Record
            transaction.set(transactionRef, {
                userId: userId,
                type: 'deduction', // Changed back from 'usage' to match frontend
                amount: -points, // Negative for deduction
                description: description,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: new Date().toISOString(),
                metadata: {
                    ...metadata,
                    // If it's a link analysis, store title in videoTitle to match frontend component logic
                    videoTitle: metadata.title || null,
                    videoAuthor: metadata.siteName || null
                }
            });

            return { success: true, newBalance: newPoints };
        });

        if (result.success) {
            console.log(`[Firebase Admin] ✅ Deducted ${points} points from user ${userId}. New balance: ${result.newBalance}`);
        }

        return result;
    } catch (error) {
        console.error(`[Firebase Admin] ❌ Failed to deduct points:`, error);
        throw error;
    }
}

/**
 * Get user points balance
 * @param userId - Firebase user UID
 * @returns Current points balance
 */
export async function getUserPoints(userId) {
    try {
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return 0;
        }

        return userDoc.data()?.pointsBalance || 0;
    } catch (error) {
        console.error(`[Firebase Admin] ❌ Failed to get user points:`, error);
        return 0;
    }
}
