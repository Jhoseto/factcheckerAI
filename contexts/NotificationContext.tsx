import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { auth } from '../services/firebase';
import { ChatNotification } from '../types';

interface NotificationContextType {
    notifications: ChatNotification[];
    removeNotification: (id: number) => void;
    requestPermission: () => Promise<boolean>;
    permissionStatus: NotificationPermission;
    isAdmin: boolean;
}

const NotificationContext = createContext<NotificationContextType>({} as NotificationContextType);

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { userProfile } = useAuth();
    const [notifications, setNotifications] = useState<ChatNotification[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
        typeof window !== 'undefined' ? Notification.permission : 'default'
    );

    // Sync isAdmin with server (matching AdminMenuButton logic) — retry on failure
    useEffect(() => {
        if (!userProfile) {
            setIsAdmin(false);
            return;
        }

        let cancelled = false;
        const maxRetries = 4;
        const baseDelay = 1500;

        const verify = async (attempt = 0) => {
            if (cancelled) return;
            try {
                const user = auth.currentUser;
                if (!user) return;

                const token = await user.getIdToken(true);
                const res = await fetch('/api/admin/verify', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!cancelled) setIsAdmin(!!data.ok);
            } catch (e) {
                if (attempt < maxRetries - 1) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    setTimeout(() => verify(attempt + 1), delay);
                } else {
                    if (!cancelled) setIsAdmin(false);
                }
            }
        };

        verify();
        return () => { cancelled = true; };
    }, [userProfile]);

    const requestPermission = async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) return false;
        const permission = await Notification.requestPermission();
        setPermissionStatus(permission);
        return permission === 'granted';
    };

    const playNotificationSound = useCallback(() => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
        audio.play().catch(e => console.log('Audio play failed:', e));
    }, []);

    const showBrowserNotification = useCallback((title: string, body: string) => {
        if (permissionStatus === 'granted') {
            new Notification(title, {
                body,
                icon: '/favicon.ico',
            });
        }
    }, [permissionStatus]);

    useEffect(() => {
        if (!userProfile || !isAdmin) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        const newSocket = io();
        setSocket(newSocket);

        newSocket.on('admin_update', (data) => {
            // Notify admin only when user explicitly chose "Real administrator" (handoff)
            if (data.type !== 'new_message' || data.sender !== 'customer' || !data.handoffRequested) return;

            const notification: ChatNotification = {
                id: Date.now(),
                sessionId: data.sessionId,
                userName: data.userName || 'Guest',
                message: `🆘 [HUMAN REQUEST] ${data.content || 'Needs help!'}`,
                timestamp: Date.now()
            };

            setNotifications(prev => [...prev, notification]);
            playNotificationSound();
            showBrowserNotification(`🆘 ${notification.userName}`, notification.message);

            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== notification.id));
            }, 15000);
        });

        return () => {
            newSocket.disconnect();
        };
    }, [userProfile, isAdmin, playNotificationSound, showBrowserNotification]);

    const removeNotification = (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <NotificationContext.Provider value={{ notifications, removeNotification, requestPermission, permissionStatus, isAdmin }}>
            {children}
        </NotificationContext.Provider>
    );
};
