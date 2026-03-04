/**
 * Activity logger — writes to Firestore activity_log
 */
import { getFirestore } from '../../server/services/firebaseAdmin.js';

export async function logActivity(userId, action, metadata = {}) {
    try {
        const db = getFirestore();
        await db.collection('activity_log').add({
            userId: userId || null,
            action: action || 'unknown',
            metadata: typeof metadata === 'object' ? metadata : {},
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error('[ActivityLogger]', e);
    }
}
