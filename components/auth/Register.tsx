import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const Register: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const { signup } = useAuth();
    const navigate = useNavigate();

    const getPasswordStrength = (pass: string) => {
        let strength = 0;
        if (pass.length > 5) strength += 20;
        if (pass.length > 8) strength += 20;
        if (/[A-Z]/.test(pass)) strength += 20;
        if (/[0-9]/.test(pass)) strength += 20;
        if (/[^A-Za-z0-9]/.test(pass)) strength += 20;
        return {
            strength,
            label: strength < 40 ? 'WEAK' : strength < 70 ? 'MEDIUM' : 'STRONG'
        };
    };

    const passwordStrength = getPasswordStrength(password);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) return setError('Passwords do not match');
        if (!agreedToTerms) return setError('Please accept the protocols');

        try {
            setError(null);
            setLoading(true);
            const userCredential = await signup(email, password);
            const user = userCredential.user;
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                displayName: displayName || user.email?.split('@')[0],
                pointsBalance: 10,
                createdAt: new Date().toISOString(),
                subscriptionTier: 'free',
                totalAudits: 0
            });
            navigate('/');
        } catch (err: any) {
            setError('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        try {
            setError(null);
            setLoading(true);
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(useAuth().auth, provider);
            const user = result.user;
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                pointsBalance: 10,
                createdAt: new Date().toISOString(),
                subscriptionTier: 'free'
            }, { merge: true });
            navigate('/');
        } catch (err: any) {
            setError('Google Signup Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden py-10">
            <div className="premium-bg-wrapper">
                <div className="premium-wave-1"></div>
                <div className="premium-wave-2"></div>
                <div className="premium-wave-3"></div>
                <div className="premium-texture"></div>
            </div>
            
            <div className="max-w-md w-full space-y-8 animate-fadeUp relative z-10">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-serif tracking-[0.2em] text-bronze-gradient uppercase">
                        FACTCHECKER
                    </h1>
                    <p className="text-[9px] font-bold text-[#666] uppercase tracking-[0.4em]">New Agent Protocol</p>
                </div>

                <div className="editorial-card p-10 space-y-8 bg-[#151515]/80 backdrop-blur-md">
                    {error && (
                         <div className="p-4 bg-red-900/10 border border-red-900/30 text-red-400 text-[10px] uppercase tracking-widest text-center font-bold">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[#666] uppercase tracking-widest pl-1">Codename</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full bg-[#121212] border border-[#222] p-4 text-xs text-[#E0E0E0] outline-none focus:border-[#968B74] transition-all rounded-sm placeholder:text-[#333] tracking-wide"
                                placeholder="Agent Name"
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[#666] uppercase tracking-widest pl-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-[#121212] border border-[#222] p-4 text-xs text-[#E0E0E0] outline-none focus:border-[#968B74] transition-all rounded-sm placeholder:text-[#333] tracking-wide"
                                placeholder="name@agency.com"
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[#666] uppercase tracking-widest pl-1">Passcode</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-[#121212] border border-[#222] p-4 text-xs text-[#E0E0E0] outline-none focus:border-[#968B74] transition-all rounded-sm placeholder:text-[#333] tracking-wide"
                                placeholder="••••••••"
                                disabled={loading}
                            />
                             {password && (
                                <div className="flex items-center gap-2 mt-2 px-1">
                                    <div className="flex-1 h-[2px] bg-[#222] overflow-hidden rounded-full">
                                        <div className={`h-full transition-all duration-500 ${passwordStrength.strength >= 70 ? 'bg-emerald-600' : 'bg-[#968B74]'}`} style={{ width: `${passwordStrength.strength}%` }}></div>
                                    </div>
                                    <span className="text-[8px] font-bold uppercase tracking-wider text-[#666]">{passwordStrength.label}</span>
                                </div>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[#666] uppercase tracking-widest pl-1">Confirm</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-[#121212] border border-[#222] p-4 text-xs text-[#E0E0E0] outline-none focus:border-[#968B74] transition-all rounded-sm placeholder:text-[#333] tracking-wide"
                                placeholder="••••••••"
                                disabled={loading}
                            />
                        </div>
                        
                        <div className="flex items-start gap-3 p-4 bg-[#121212] rounded-sm border border-[#222]">
                            <input
                                type="checkbox"
                                id="terms"
                                checked={agreedToTerms}
                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                                className="mt-1 w-3 h-3 accent-[#968B74]"
                                disabled={loading}
                            />
                            <label htmlFor="terms" className="text-[9px] text-[#666] leading-relaxed tracking-wide uppercase">
                                I accept the <a href="#" className="text-[#968B74] hover:text-[#E6D2A8] border-b border-[#968B74]/30">Protocol Terms</a>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-luxury-solid py-4 text-[10px] font-black uppercase tracking-[0.25em] rounded-sm transition-transform active:scale-[0.98] mt-2"
                        >
                            {loading ? 'Processing...' : 'INITIALIZE'}
                        </button>
                    </form>

                     <div className="text-center pt-4 border-t border-[#222]">
                        <p className="text-[9px] text-[#666] tracking-wide">
                            Have clearance? <a href="/login" className="text-[#968B74] font-bold hover:text-[#E6D2A8] uppercase transition-colors ml-1 border-b border-[#968B74]/30">Login</a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
