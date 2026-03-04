/**
 * Visit tracking — calls POST /api/track/visit
 */
import { auth } from './firebase';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '';

export async function trackVisit(path: string, action: 'page_view' | 'login' = 'page_view') {
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
