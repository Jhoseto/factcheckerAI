/**
 * Admin menu button — renders only when user is admin. For Navbar dropdown.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAdmin } from '../api';

interface AdminMenuButtonProps {
    onNavigate: () => void;
    className?: string;
}

export const AdminMenuButton: React.FC<AdminMenuButtonProps> = ({ onNavigate, className = '' }) => {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const verify = () => fetchAdmin('/verify');
        verify()
            .then(r => {
                if (r.ok) return setIsAdmin(true);
                if (r.status === 403) {
                    return new Promise<void>(resolve => setTimeout(resolve, 300))
                        .then(() => verify())
                        .then(r2 => setIsAdmin(r2.ok));
                }
                setIsAdmin(false);
            })
            .catch(() => setIsAdmin(false));
    }, []);

    if (!isAdmin) return null;

    return (
        <button
            onClick={() => {
                navigate('/admin');
                onNavigate();
            }}
            className={className || 'w-full text-left px-4 py-3 text-[9px] font-bold text-[#968B74] uppercase tracking-[0.2em] hover:bg-[#252525] rounded transition-colors flex justify-between'}
        >
            Админ <span className="text-[#444]">→</span>
        </button>
    );
};
