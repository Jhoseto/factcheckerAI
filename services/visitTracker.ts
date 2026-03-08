/**
 * Visit tracking — calls POST /api/track/visit
 * Client-side debounce: max 1 call per 8 sec to avoid 429 on rapid nav / Strict Mode
 */
import { auth } from './firebase';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '';
let lastTrack = 0;
const DEBOUNCE_MS = 5000;

export async function trackVisit(path: string, action: 'page_view' | 'login' = 'page_view') {
    const now = Date.now();
    if (now - lastTrack < DEBOUNCE_MS && action === 'page_view') return;
    lastTrack = now;

    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const user = auth.currentUser;
        if (user) {
            const token = await user.getIdToken();
            headers['Authorization'] = `Bearer ${token}`;
        }
        await fetch(`${API_BASE}/api/track/visit`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ path, action })
        });
    } catch {
        // ignore
    }
}
