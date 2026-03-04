import React from 'react';
import { Link } from 'react-router-dom';

interface User {
    id: string;
    email?: string;
    displayName?: string;
    pointsBalance?: number;
    createdAt?: string;
}

interface UsersTableProps {
    users: User[];
}

export const UsersTable: React.FC<UsersTableProps> = ({ users }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-[#333]">
                    <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Имейл</th>
                    <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Име</th>
                    <th className="text-right py-3 px-2 text-[8px] font-black text-[#666] uppercase">Точки</th>
                    <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase">Регистрация</th>
                    <th className="text-left py-3 px-2 text-[8px] font-black text-[#666] uppercase"></th>
                </tr>
            </thead>
            <tbody>
                {users.map((u) => (
                    <tr key={u.id} className="border-b border-[#333] hover:bg-[#252525]">
                        <td className="py-3 px-2 text-[#ddd]">{u.email || '—'}</td>
                        <td className="py-3 px-2 text-[#ddd]">{u.displayName || '—'}</td>
                        <td className="py-3 px-2 text-right font-bold text-[#C4B091]">{u.pointsBalance ?? 0}</td>
                        <td className="py-3 px-2 text-[#888] text-[10px]">{(u.createdAt || '').slice(0, 10)}</td>
                        <td className="py-3 px-2">
                            <Link to={`/admin/users/${u.id}`} className="text-[9px] font-bold text-[#968B74] hover:text-[#C4B091]">
                                Преглед
                            </Link>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);
