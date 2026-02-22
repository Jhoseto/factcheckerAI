import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setError(null);
            setLoading(true);
            await login(email, password);
            navigate('/');
        } catch (err: any) {
            setError('Грешка при вход: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            setError(null);
            setLoading(true);
            await loginWithGoogle();
            navigate('/');
        } catch (err: any) {
            setError('Грешка при вход с Google: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
            {/* The Silky Background */}
            <div className="premium-bg-wrapper">
                <div className="premium-wave-1"></div>
                <div className="premium-wave-2"></div>
                <div className="premium-wave-3"></div>
                <div className="premium-texture"></div>
            </div>

            <div className="max-w-md w-full space-y-12 animate-fadeUp z-10 relative">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-serif tracking-[0.15em] text-bronze-gradient uppercase">
                        FACTCHECKER
                    </h1>
                    <div className="flex items-center justify-center gap-4 opacity-60">
                         <div className="h-[1px] w-8 bg-[#8A6E3E]"></div>
                         <p className="text-[9px] font-bold text-[#888] uppercase tracking-[0.3em]">Secure Access</p>
                         <div className="h-[1px] w-8 bg-[#8A6E3E]"></div>
                    </div>
                </div>

                <div className="editorial-card p-10 space-y-8 bg-[#151515]/80 backdrop-blur-md">
                    {error && (
                        <div className="p-4 bg-red-900/10 border border-red-900/30 text-red-400 text-[10px] uppercase tracking-widest text-center font-bold">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-[#666] uppercase tracking-widest pl-1">Email Identity</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-[#121212] border border-[#222] p-4 text-xs text-[#E0E0E0] outline-none focus:border-[#968B74] transition-all rounded-sm placeholder:text-[#333] tracking-wide font-medium"
                                placeholder="name@example.com"
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-[#666] uppercase tracking-widest pl-1">Passcode</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-[#121212] border border-[#222] p-4 text-xs text-[#E0E0E0] outline-none focus:border-[#968B74] transition-all rounded-sm placeholder:text-[#333] tracking-wide"
                                placeholder="••••••••"
                                disabled={loading}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-luxury-solid py-4 text-[10px] uppercase tracking-[0.25em] rounded-sm transition-transform active:scale-[0.98] mt-4"
                        >
                            {loading ? 'Authenticating...' : 'ACCESS SYSTEM'}
                        </button>
                    </form>

                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[#222]"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-4 bg-[#151515] text-[9px] text-[#444] uppercase tracking-widest font-bold">Alternative</span>
                        </div>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full py-3 bg-transparent border border-[#333] text-[#888] text-[9px] font-bold uppercase tracking-[0.2em] hover:border-[#968B74] hover:text-[#968B74] transition-all flex items-center justify-center gap-3 rounded-sm group"
                    >
                         <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24"><path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                        Google Access
                    </button>

                    <div className="text-center pt-6 border-t border-[#222]">
                        <p className="text-[9px] text-[#666] tracking-wide">
                            No credentials? <a href="/register" className="text-[#968B74] font-bold hover:text-[#E6D2A8] uppercase transition-colors ml-1 border-b border-[#968B74]/30 hover:border-[#E6D2A8]">Request Access</a>
                        </p>
                    </div>
                </div>
                
                <p className="text-center text-[8px] text-[#444] uppercase tracking-[0.2em] font-mono opacity-50">
                    Restricted Area • Authorized Personnel Only
                </p>
            </div>
        </div>
    );
};

export default Login;
