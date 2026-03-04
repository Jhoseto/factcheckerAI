/**
 * Server-side config helpers
 */
import { getFirestore } from './firebaseAdmin.js';

let configCache = null;
let configCacheTime = 0;
const CACHE_MS = 60000;

export async function getConfig() {
    if (configCache && Date.now() - configCacheTime < CACHE_MS) {
        return configCache;
    }
    try {
        const db = getFirestore();
        const doc = await db.collection('config').doc('main').get();
        configCache = doc.exists ? doc.data() : {};
    } catch {
        configCache = {};
    }
    configCacheTime = Date.now();
    return configCache;
}

export async function getMaxAnalysesPerDay() {
    const c = await getConfig();
    const n = c.maxAnalysesPerDay;
    return (typeof n === 'number' && n > 0) ? n : null;
}

export async function getAnalysesCountToday(userId) {
    const db = getFirestore();
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = await db.collection('transactions')
        .where('userId', '==', userId)
        .where('type', '==', 'deduction')
        .limit(500)
        .get();
    let count = 0;
    snapshot.docs.forEach(d => {
        const createdAt = d.data().createdAt || d.data().timestamp?.toDate?.()?.toISOString?.() || '';
        if (String(createdAt).slice(0, 10) === today) count++;
    });
    return count;
}
