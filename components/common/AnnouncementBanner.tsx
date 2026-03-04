import React, { useEffect, useState } from 'react';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '';

export const AnnouncementBanner: React.FC = () => {
    const [announcement, setAnnouncement] = useState<{ text: string; until?: string } | null>(null);

    useEffect(() => {
        fetch(`${API_BASE}/api/config/announcement`)
            .then(r => r.json())
            .then(d => setAnnouncement(d.announcement))
            .catch(() => setAnnouncement(null));
    }, []);

    if (!announcement?.text) return null;

    const until = announcement.until;
    if (until && new Date(until) < new Date()) return null;

    return (
        <div className="bg-[#968B74] text-[#1a1a1a] text-center py-2 px-4 text-sm font-bold">
            {announcement.text}
        </div>
    );
};
