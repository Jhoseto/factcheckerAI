/**
 * Admin API client
 */
import { auth } from '../../services/firebase';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '';

export async function fetchAdmin(path: string, options: RequestInit = {}): Promise<Response> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const token = await user.getIdToken();
    const url = `${API_BASE}/api/admin${path.startsWith('/') ? path : '/' + path}`;

    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        },
    });
}

export async function fetchAdminJson<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetchAdmin(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
    return data as T;
}
