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

    // Sync isAdmin with server (matching AdminMenuButton logic)
    useEffect(() => {
        const verify = async () => {
            if (!userProfile) {
                setIsAdmin(false);
                return;
            }
            try {
                const user = auth.currentUser;
                if (!user) return;

                const token = await user.getIdToken(true);
                const res = await fetch('/api/admin/verify', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                setIsAdmin(!!data.ok);
            } catch (e) {
                setIsAdmin(false);
            }
        };

        verify();
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
            if (data.type === 'new_message' && data.sender !== 'admin') {
                const notification: ChatNotification = {
                    id: Date.now(),
                    sessionId: data.sessionId,
                    userName: data.userName || (data.sender === 'ai' ? 'AI Assistant' : 'Guest'),
                    message: data.content || 'New message received!',
                    timestamp: Date.now()
                };

                setNotifications(prev => [...prev, notification]);
                playNotificationSound();
                showBrowserNotification(notification.userName, notification.message);

                setTimeout(() => {
                    setNotifications(prev => prev.filter(n => n.id !== notification.id));
                }, 10000);
            }
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
