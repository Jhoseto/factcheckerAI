/**
 * GET /api/admin/health — Status of Firebase, Gemini, Lemon Squeezy
 */
import express from 'express';
import { requireAdmin } from '../middleware.js';
import { getFirestore } from '../../../server/services/firebaseAdmin.js';
import { GoogleGenAI } from '@google/genai';

const router = express.Router();

async function checkFirebase() {
    try {
        const db = getFirestore();
        const snap = await db.collection('users').limit(1).get();
        return { ok: true, message: 'Firestore достъпен' };
    } catch (e) {
        return { ok: false, message: e.message || 'Firestore грешка' };
    }
}

async function checkGemini() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY;
    if (!apiKey || apiKey.length < 10) {
        return { ok: false, message: 'GEMINI_API_KEY не е конфигуриран' };
    }
    try {
        const genai = new GoogleGenAI({ apiKey });
        const resp = await genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }]
        });
        return { ok: true, message: 'Gemini API достъпен' };
    } catch (e) {
        return { ok: false, message: e.message || 'Gemini API грешка' };
    }
}

async function checkLemonSqueezy() {
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
    if (!apiKey || !storeId) {
        return { ok: false, message: 'LEMON_SQUEEZY_API_KEY или STORE_ID не са конфигурирани' };
    }
    try {
        const res = await fetch(`https://api.lemonsqueezy.com/v1/stores/${storeId}`, {
            headers: { Authorization: `Bearer ${apiKey}` }
        });
        if (res.ok) return { ok: true, message: 'Lemon Squeezy API достъпен' };
        return { ok: false, message: `HTTP ${res.status}` };
    } catch (e) {
        return { ok: false, message: e.message || 'Lemon Squeezy грешка' };
    }
}

router.get('/', requireAdmin, async (req, res) => {
    try {
        const [firebase, gemini, lemon] = await Promise.all([
            checkFirebase(),
            checkGemini(),
            checkLemonSqueezy()
        ]);
        res.json({
            firebase: { name: 'Firebase', ...firebase },
            gemini: { name: 'Gemini API', ...gemini },
            lemonSqueezy: { name: 'Lemon Squeezy', ...lemon }
        });
    } catch (e) {
        console.error('[Admin health]', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
