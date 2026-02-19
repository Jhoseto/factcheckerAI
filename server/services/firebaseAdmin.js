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
        let serviceAccount = null;

        // 1) Production (Cloud Run): full JSON from env. Проверяваме няколко имена на променливи.
        const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
            || process.env.FIREBASE_SERVICE_ACCOUNT
            || process.env.FIREBASE_CREDENTIALS
            || process.env.firebase_service_account_json;
        if (jsonEnv) {
            try {
                let jsonStr = (typeof jsonEnv === 'string' ? jsonEnv : JSON.stringify(jsonEnv)).trim();
                if (!jsonStr.startsWith('{')) {
                    console.error('[Firebase Admin] Firebase service account env variable does not look like JSON');
                    return false;
                }
                serviceAccount = JSON.parse(jsonStr);
                if (!serviceAccount.private_key || !serviceAccount.client_email) {
                    console.error('[Firebase Admin] Firebase service account JSON missing required fields');
                    return false;
                }
            } catch (e) {
                console.error('[Firebase Admin] Firebase service account env variable is invalid JSON:', e.message);
                return false;
            }
        }

        // 2) File: firebase-service-account.json (local or mounted path)
        if (!serviceAccount) {
            const absolutePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
                ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
                : path.resolve(__dirname, '../../firebase-service-account.json');
            try {
                serviceAccount = JSON.parse(readFileSync(absolutePath, 'utf8'));
            } catch (fileError) {
                if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE) {
                    admin.initializeApp();
                } else {
                    throw fileError;
                }
            }
        }

        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }

        adminInitialized = true;
        return true;
    } catch (error) {
        console.error('[Firebase Admin] Not initialized:', error.message);
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
        console.error('[Firebase Admin] Cannot add points - not initialized');
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
                console.error(`[Firebase Admin] Insufficient points for user ${userId}: has ${currentPoints}, needs ${points}`);
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
                    // For video analysis: preserve video metadata
                    videoTitle: metadata.videoTitle || metadata.title || null,
                    videoAuthor: metadata.videoAuthor || metadata.author || metadata.siteName || null,
                    videoId: metadata.videoId || null,
                    videoDuration: metadata.videoDuration || metadata.duration || null,
                    thumbnailUrl: metadata.thumbnailUrl || null
                }
            });

            return { success: true, newBalance: newPoints };
        });

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
