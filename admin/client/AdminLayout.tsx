/**
 * Admin layout — sidebar + outlet
 */
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

interface AdminLayoutProps {
    isSuperAdmin: boolean;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ isSuperAdmin }) => {
    return (
        <div className="min-h-screen bg-[#1a1a1a] flex pt-32">
            <aside className="w-56 border-r border-[#333] bg-[#222] p-4 flex flex-col gap-2 fixed left-0 top-32 bottom-0">
                <h2 className="text-[10px] font-black text-[#968B74] uppercase tracking-widest mb-4">Админ</h2>
                <NavLink
                    to="/admin"
                    end
                    className={({ isActive }) =>
                        `px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${isActive ? 'bg-[#968B74]/20 text-[#C4B091] border-l-2 border-[#968B74]' : 'text-[#888] hover:text-[#C4B091] hover:bg-[#333]'}`
                    }
                >
                    Табло
                </NavLink>
                <NavLink
                    to="/admin/users"
                    className={({ isActive }) =>
                        `px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${isActive ? 'bg-[#968B74]/20 text-[#C4B091] border-l-2 border-[#968B74]' : 'text-[#888] hover:text-[#C4B091] hover:bg-[#333]'}`
                    }
                >
                    Потребители
                </NavLink>
                {isSuperAdmin && (
                    <NavLink
                        to="/admin/admins"
                        className={({ isActive }) =>
                            `px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${isActive ? 'bg-[#968B74]/20 text-[#C4B091] border-l-2 border-[#968B74]' : 'text-[#888] hover:text-[#C4B091] hover:bg-[#333]'}`
                        }
                    >
                        Администратори
                    </NavLink>
                )}
                <NavLink
                    to="/admin/revenue"
                    className={({ isActive }) =>
                        `px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${isActive ? 'bg-[#968B74]/20 text-[#C4B091] border-l-2 border-[#968B74]' : 'text-[#888] hover:text-[#C4B091] hover:bg-[#333]'}`
                    }
                >
                    Приходи
                </NavLink>
                <NavLink
                    to="/admin/transactions"
                    className={({ isActive }) =>
                        `px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${isActive ? 'bg-[#968B74]/20 text-[#C4B091] border-l-2 border-[#968B74]' : 'text-[#888] hover:text-[#C4B091] hover:bg-[#333]'}`
                    }
                >
                    Транзакции
                </NavLink>
                <NavLink
                    to="/admin/activity"
                    className={({ isActive }) =>
                        `px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${isActive ? 'bg-[#968B74]/20 text-[#C4B091] border-l-2 border-[#968B74]' : 'text-[#888] hover:text-[#C4B091] hover:bg-[#333]'}`
                    }
                >
                    Дневник
                </NavLink>
                <NavLink
                    to="/admin/analyses"
                    className={({ isActive }) =>
                        `px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${isActive ? 'bg-[#968B74]/20 text-[#C4B091] border-l-2 border-[#968B74]' : 'text-[#888] hover:text-[#C4B091] hover:bg-[#333]'}`
                    }
                >
                    Анализи
                </NavLink>
                <NavLink
                    to="/admin/analyses-list"
                    className={({ isActive }) =>
                        `px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${isActive ? 'bg-[#968B74]/20 text-[#C4B091] border-l-2 border-[#968B74]' : 'text-[#888] hover:text-[#C4B091] hover:bg-[#333]'}`
                    }
                >
                    Списък анализи
                </NavLink>
                {isSuperAdmin && (
                    <NavLink
                        to="/admin/settings"
                        className={({ isActive }) =>
                            `px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${isActive ? 'bg-[#968B74]/20 text-[#C4B091] border-l-2 border-[#968B74]' : 'text-[#888] hover:text-[#C4B091] hover:bg-[#333]'}`
                        }
                    >
                        Настройки
                    </NavLink>
                )}
                <NavLink
                    to="/admin/visits"
                    className={({ isActive }) =>
                        `px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${isActive ? 'bg-[#968B74]/20 text-[#C4B091] border-l-2 border-[#968B74]' : 'text-[#888] hover:text-[#C4B091] hover:bg-[#333]'}`
                    }
                >
                    Посещения
                </NavLink>
                <NavLink
                    to="/admin/chat"
                    className={({ isActive }) =>
                        `px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${isActive ? 'bg-[#968B74]/20 text-[#C4B091] border-l-2 border-[#968B74]' : 'text-[#888] hover:text-[#C4B091] hover:bg-[#333]'}`
                    }
                >
                    Чат поддръжка
                </NavLink>
            </aside>
            <main className="flex-1 p-8 overflow-auto ml-56">
                <Outlet />
            </main>
        </div>
    );
};

export default AdminLayout;
