import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '';
const DISMISSED_KEY = 'factchecker_dismissed_messages';

export const UserMessageBanner: React.FC = () => {
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState<Array<{ id: string; message: string }>>([]);

    useEffect(() => {
        if (!currentUser) return;
        let cancelled = false;
        currentUser.getIdToken().then(token =>
            fetch(`${API_BASE}/api/user-messages`, { headers: { Authorization: `Bearer ${token}` } })
        ).then(r => r.json()).then(d => {
            if (cancelled) return;
            const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
            const filtered = (d.messages || []).filter((m: { id: string }) => !dismissed.includes(m.id));
            setMessages(filtered);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [currentUser]);

    const dismiss = (id: string) => {
        const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
        if (!dismissed.includes(id)) {
            dismissed.push(id);
            localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
        }
        setMessages(prev => prev.filter(m => m.id !== id));
    };

    if (messages.length === 0) return null;

    return (
        <div className="space-y-2 px-4 py-2">
            {messages.map(m => (
                <div key={m.id} className="bg-[#968B74]/20 border border-[#968B74]/40 text-[#C4B091] text-center py-2 px-4 text-sm flex items-center justify-center gap-4">
                    <span className="flex-1">{m.message}</span>
                    <button onClick={() => dismiss(m.id)} className="text-[#888] hover:text-[#ddd] text-[10px] uppercase font-bold">
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
};
