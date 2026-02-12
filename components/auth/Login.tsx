import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            setError('Моля, попълнете всички полета');
            return;
        }

        setError('');
        setLoading(true);

        try {
            await login(email, password);
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Грешка при вход');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);

        try {
            await loginWithGoogle();
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Грешка при вход с Google');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-50 via-amber-50/30 to-slate-50">
            <div className="max-w-md w-full space-y-8 animate-fadeIn">
                {/* Logo/Header */}
                <div className="text-center">
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 uppercase mb-2 serif italic flex items-center justify-center gap-2">
                        <span>FACTCHECKER</span>
                        <span className="bg-amber-900 text-white px-2 py-1 rounded-sm text-xl font-black">AI</span>
                    </h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Вход в системата</p>
                </div>

                {/* Login Card */}
                <div className="editorial-card p-8 space-y-6 border-b-4 border-b-slate-900 animate-slideUp">
                    {error && (
                        <div className="p-4 bg-red-50 border-l-4 border-red-600 animate-shake">
                            <p className="text-sm font-bold text-red-900">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-200 p-4 font-semibold text-sm outline-none focus:border-slate-900 transition-all focus:ring-4 focus:ring-slate-900/10 rounded-sm"
                                placeholder="your@email.com"
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                Парола
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-200 p-4 font-semibold text-sm outline-none focus:border-slate-900 transition-all focus:ring-4 focus:ring-slate-900/10 rounded-sm"
                                placeholder="••••••••"
                                disabled={loading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full p-4 text-xs font-black uppercase tracking-widest transition-all shadow-lg ${loading
                                    ? 'bg-slate-400 text-slate-200 cursor-not-allowed'
                                    : 'bg-slate-900 text-white hover:bg-black active:scale-[0.98] hover:shadow-xl'
                                }`}
                        >
                            {loading ? 'ЗАРЕЖДАНЕ...' : 'ВХОД'}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-4 bg-white text-slate-400 font-bold uppercase tracking-wider">или</span>
                        </div>
                    </div>

                    {/* Google Login */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full p-4 bg-white border-2 border-slate-200 text-slate-900 font-black text-xs uppercase tracking-wider hover:border-slate-900 hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
                    >
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        ВХОД С GOOGLE
                    </button>

                    {/* Register Link */}
                    <div className="text-center pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-600">
                            Нямате акаунт?{' '}
                            <a
                                href="/register"
                                className="font-black text-amber-900 hover:text-amber-950 uppercase tracking-wider transition-colors"
                            >
                                Регистрирайте се
                            </a>
                        </p>
                    </div>
                </div>

                <p className="text-center text-xs text-slate-400 italic">
                    Защитено съгласно съвременните стандарти за сигурност
                </p>
            </div>

            <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideUp {
          animation: slideUp 0.6s ease-out forwards;
        }
      `}</style>
        </div>
    );
};

export default Login;
