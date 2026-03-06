/**
 * ChatBot Admin page — protected by admin auth
 */
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import AdminDashboard from '../../chatBot/src/components/AdminDashboard';
import { fetchAdminJson } from '../../admin/client/api';

export default function ChatBotAdminPage() {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    fetchAdminJson<{ ok?: boolean }>('/verify')
      .then(d => setVerified(!!d.ok))
      .catch(() => setVerified(false));
  }, []);

  if (verified === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#222]">
        <div className="w-16 h-16 border-4 border-[#333] border-t-[#968B74] rounded-full animate-spin" />
      </div>
    );
  }

  if (!verified) return <Navigate to="/" replace />;

  return <AdminDashboard />;
}
