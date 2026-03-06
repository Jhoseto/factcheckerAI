/**
 * Chat Support — part of admin dashboard
 */
import React from 'react';
import AdminDashboard from '../../../chatBot/src/components/AdminDashboard';

export const ChatSupport: React.FC = () => {
    return (
        <div className="-m-8 h-[calc(100vh-8rem)] min-h-0 [&>div]:!h-full">
            <AdminDashboard />
        </div>
    );
};
