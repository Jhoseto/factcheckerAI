/**
 * Admin Firestore queries — uses main app's Firebase Admin
 */
import admin from 'firebase-admin';
import { getFirestore } from '../../../server/services/firebaseAdmin.js';

function toIso(val) {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val && val.toDate && typeof val.toDate === 'function') return val.toDate().toISOString();
    return '';
}

export function getDb() {
    return getFirestore();
}

export async function getUsers(limit = 50, startAfter = null, searchQ = '') {
    const db = getDb();
    const snapshot = await db.collection('users').limit(200).get();
    let users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    users.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (searchQ && searchQ.trim()) {
        const q = searchQ.toLowerCase().trim();
        users = users.filter(u =>
            (u.email || '').toLowerCase().includes(q) ||
            (u.displayName || '').toLowerCase().includes(q)
        );
    }
    return users.slice(0, limit);
}

export async function getUser(uid) {
    const db = getDb();
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

export async function getUserTransactions(uid, limit = 30) {
    const db = getDb();
    const snapshot = await db.collection('transactions')
        .where('userId', '==', uid)
        .limit(100)
        .get();
    let list = snapshot.docs.map(d => {
        const data = d.data();
        let createdAt = data.createdAt;
        if (createdAt && typeof createdAt.toDate === 'function') createdAt = createdAt.toDate().toISOString();
        if (!createdAt && data.timestamp?.toDate) createdAt = data.timestamp.toDate().toISOString();
        return { id: d.id, ...data, createdAt: createdAt || '' };
    });
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list.slice(0, limit);
}

export async function getUserAnalyses(uid, limit = 30) {
    const db = getDb();
    const snapshot = await db.collection('analyses')
        .where('userId', '==', uid)
        .limit(100)
        .get();
    let list = snapshot.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: toIso(data.createdAt) };
    });
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list.slice(0, limit);
}

export async function getRecentAnalyses(limit = 10) {
    const db = getDb();
    const snapshot = await db.collection('analyses').limit(200).get();
    let list = snapshot.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: toIso(data.createdAt) };
    });
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list.slice(0, limit);
}

export async function getAnalysesList(limit = 100) {
    const db = getDb();
    const snapshot = await db.collection('analyses').limit(500).get();
    let list = snapshot.docs.map(d => {
        const data = d.data();
        const meta = data.metadata || data.analysis?.metadata || {};
        const points = meta.pointsCost ?? meta.points ?? data.pointsCost ?? data.analysis?.pointsCost ?? 0;
        return {
            id: d.id,
            userId: data.userId,
            type: data.type || 'link',
            title: data.title || (data.url || '').slice(0, 60) || d.id,
            url: data.url,
            createdAt: toIso(data.createdAt),
            isPublic: !!data.isPublic,
            pointsCost: points
        };
    });
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list.slice(0, limit);
}

export async function getTransactions(limit = 100, typeFilter = '') {
    const db = getDb();
    const snapshot = await db.collection('transactions').limit(500).get();
    let list = snapshot.docs.map(d => {
        const data = d.data();
        let createdAt = data.createdAt;
        if (createdAt && typeof createdAt.toDate === 'function') createdAt = createdAt.toDate().toISOString();
        if (!createdAt && data.timestamp?.toDate) createdAt = data.timestamp.toDate().toISOString();
        return { id: d.id, ...data, createdAt: createdAt || '' };
    });
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    list = list.slice(0, limit);
    if (typeFilter) list = list.filter(t => (t.type || '') === typeFilter);
    return list;
}

export async function getAnalysesAggregation(days = 7) {
    const db = getDb();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();
    const snapshot = await db.collection('analyses').limit(500).get();
    const list = snapshot.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: toIso(data.createdAt) };
    });
    const filtered = list.filter(a => (a.createdAt || '') >= sinceStr);
    const byType = { video: 0, link: 0 };
    const byDay = {};
    filtered.forEach(a => {
        const t = (a.type || 'link').toLowerCase();
        byType[t] = (byType[t] || 0) + 1;
        const day = (a.createdAt || '').slice(0, 10);
        byDay[day] = (byDay[day] || 0) + 1;
    });
    return { byType, byDay, total: filtered.length };
}

export async function getAdmins() {
    const db = getDb();
    const snapshot = await db.collection('admins').orderBy('promotedAt', 'desc').get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addAdmin(uid, email, promotedBy) {
    const db = getDb();
    await db.collection('admins').doc(uid).set({
        uid,
        email: email || '',
        promotedAt: new Date().toISOString(),
        promotedBy
    });
}

export async function removeAdmin(uid) {
    const db = getDb();
    await db.collection('admins').doc(uid).delete();
}

export async function logVisit(ip, userId, path, userAgent, action) {
    const db = getDb();
    await db.collection('visit_log').add({
        ip: ip || '',
        userId: userId || null,
        path: path || '/',
        userAgent: userAgent || '',
        action: action || 'page_view',
        timestamp: new Date().toISOString()
    });
}

export async function getActivityLog(filters = {}) {
    const db = getDb();
    const snapshot = await db.collection('activity_log').orderBy('timestamp', 'desc').limit(filters.limit || 100).get();
    let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (filters.userId) list = list.filter(a => a.userId === filters.userId);
    if (filters.action) list = list.filter(a => a.action === filters.action);
    if (filters.from) list = list.filter(a => (a.timestamp || '') >= filters.from);
    if (filters.to) list = list.filter(a => (a.timestamp || '') <= filters.to + 'T23:59:59');
    return list;
}

export async function getVisits(filters = {}) {
    const db = getDb();
    let q = db.collection('visit_log').orderBy('timestamp', 'desc').limit(filters.limit || 100);
    const snapshot = await q.get();
    let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (filters.ip) list = list.filter(v => (v.ip || '').includes(filters.ip));
    if (filters.userId) list = list.filter(v => v.userId === filters.userId);
    if (filters.action) list = list.filter(v => v.action === filters.action);
    if (filters.from) list = list.filter(v => (v.timestamp || '') >= filters.from);
    if (filters.to) list = list.filter(v => (v.timestamp || '') <= filters.to + 'T23:59:59');
    return list;
}

export async function getRevenue(filters = {}) {
    const db = getDb();
    const snapshot = await db.collection('transactions').where('type', '==', 'purchase').limit(1000).get();
    let list = snapshot.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: toIso(data.createdAt) };
    });
    list = list.filter(t => t.source !== 'lemonsqueezy_test');
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (filters.from) list = list.filter(t => (t.createdAt || '') >= filters.from);
    if (filters.to) list = list.filter(t => (t.createdAt || '') <= filters.to + 'T23:59:59');
    const totalPoints = list.reduce((s, t) => s + (t.amount || 0), 0);
    const byMonth = {};
    list.forEach(t => {
        const month = (t.createdAt || '').slice(0, 7);
        if (month) byMonth[month] = (byMonth[month] || 0) + (t.amount || 0);
    });
    return { transactions: list, totalPoints, byMonth };
}

export async function getStats() {
    const db = getDb();
    const usersSnap = await db.collection('users').get();
    const totalUsers = usersSnap.size;

    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    let newUsersToday = 0;
    let newUsersWeek = 0;
    usersSnap.docs.forEach(d => {
        const createdAt = d.data().createdAt || '';
        if (createdAt.startsWith(today)) newUsersToday++;
        if (createdAt >= weekAgoStr) newUsersWeek++;
    });

    const weekAgoTs = admin.firestore.Timestamp.fromDate(weekAgo);
    const analysesSnap = await db.collection('analyses')
        .where('createdAt', '>=', weekAgoTs)
        .get();
    const analysesWeek = analysesSnap.size;

    const txSnap = await db.collection('transactions')
        .where('type', '==', 'deduction')
        .limit(1000)
        .get();
    let pointsSpent = 0;
    const pointsByDay = {};
    txSnap.docs.forEach(d => {
        const data = d.data();
        const amt = data.amount;
        const created = toIso(data.createdAt) || toIso(data.timestamp);
        if (typeof amt === 'number' && amt < 0 && created >= weekAgoStr) {
            pointsSpent += Math.abs(amt);
            const day = created.slice(0, 10);
            pointsByDay[day] = (pointsByDay[day] || 0) + Math.abs(amt);
        }
    });

    const usersByDay = {};
    const analysesByDay = {};
    usersSnap.docs.forEach(d => {
        const created = d.data().createdAt || '';
        if (created >= weekAgoStr) {
            const day = created.slice(0, 10);
            usersByDay[day] = (usersByDay[day] || 0) + 1;
        }
    });
    analysesSnap.docs.forEach(d => {
        const created = toIso(d.data().createdAt);
        if (created >= weekAgoStr) {
            const day = created.slice(0, 10);
            analysesByDay[day] = (analysesByDay[day] || 0) + 1;
        }
    });

    return {
        totalUsers,
        newUsersToday,
        newUsersWeek,
        analysesWeek,
        pointsSpentWeek: pointsSpent,
        usersByDay,
        analysesByDay,
        pointsByDay
    };
}
