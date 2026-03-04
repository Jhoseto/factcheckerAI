import React from 'react';

interface Admin {
    uid: string;
    email?: string;
    promotedAt?: string;
    promotedBy?: string;
}

interface AdminsTableProps {
    admins: Admin[];
    onDemote: (uid: string) => void;
    isSuperAdmin: boolean;
    superAdminEmail: string;
}

export const AdminsTable: React.FC<AdminsTableProps> = ({ admins, onDemote, isSuperAdmin, superAdminEmail }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-[#333]">
                    <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Имейл</th>
                    <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Повишен</th>
                    <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Роля</th>
                    {isSuperAdmin && <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Действия</th>}
                </tr>
            </thead>
            <tbody>
                {admins.map((a) => {
                    const isSA = (a.email || '').toLowerCase() === superAdminEmail.toLowerCase();
                    return (
                        <tr key={a.uid} className="border-b border-[#333] hover:bg-[#252525]">
                            <td className="py-3 px-2 text-[#ddd]">{a.email || a.uid}</td>
                            <td className="py-3 px-2 text-[#888] text-[10px]">{(a.promotedAt || '').slice(0, 10)}</td>
                            <td className="py-3 px-2">
                                <span className="text-[9px] font-bold text-[#C4B091]">{isSA ? 'Главен администратор' : 'Администратор'}</span>
                            </td>
                            {isSuperAdmin && (
                                <td className="py-3 px-2">
                                    {!isSA && (
                                        <button
                                            onClick={() => onDemote(a.uid)}
                                            className="text-[9px] font-bold text-[#c66] hover:text-[#e88]"
                                        >
                                            Понижи
                                        </button>
                                    )}
                                </td>
                            )}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);
