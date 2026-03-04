import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { usePublicConfig } from '../../contexts/PublicConfigContext';

const Login: React.FC = () => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const { login, loginWithGoogle } = useAuth();
    const { newRegistrationEnabled } = usePublicConfig();
    const [searchParams] = useSearchParams();
    const regDisabled = searchParams.get('reg') === 'disabled';
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setError(null);
            setLoading(true);
            await login(email, password);
            navigate('/');
        } catch (err: any) {
            setError(t('auth.loginError', { message: err.message }));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        if (!agreedToTerms) {
            setError(t('auth.acceptTermsBeforeLogin'));
            return;
        }
        try {
            setError(null);
            setLoading(true);
            await loginWithGoogle();
            navigate('/');
        } catch (err: any) {
            setError(t('auth.loginGoogleError', { message: err.message }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 max-md:py-6 relative overflow-hidden">
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
                         <p className="text-[9px] font-bold text-[#888] uppercase tracking-[0.3em]">{t('auth.secureAccess')}</p>
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
                            <label className="text-[9px] font-bold text-[#666] uppercase tracking-widest pl-1">{t('auth.emailIdentity')}</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-[#121212] border border-[#222] p-4 text-xs text-[#E0E0E0] outline-none focus:border-[#968B74] transition-all rounded-sm placeholder:text-[#333] tracking-wide font-medium"
                                placeholder={t('auth.emailPlaceholder')}
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-[#666] uppercase tracking-widest pl-1">{t('auth.passcode')}</label>
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
                            {loading ? t('auth.authenticating') : t('auth.accessSystem')}
                        </button>
                    </form>

                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[#222]"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-4 bg-[#151515] text-[9px] text-[#444] uppercase tracking-widest font-bold">{t('auth.googleAccess')}</span>
                        </div>
                    </div>

                    <p className="text-[9px] text-[#888] leading-relaxed px-1">
                        <Trans i18nKey="auth.registerAcceptWithLinks" components={{
                            termsLink: <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-[8px] font-normal text-[#968B74] hover:text-[#C4B091] border-b border-[#968B74]/30" />,
                            privacyLink: <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-[8px] font-normal text-[#968B74] hover:text-[#C4B091] border-b border-[#968B74]/30" />
                        }} />
                    </p>
                    <div className="flex items-start gap-3 p-3 bg-[#121212] rounded-sm border border-[#222]">
                        <input
                            type="checkbox"
                            id="login-terms"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            className="mt-1 w-3 h-3 accent-[#968B74]"
                            disabled={loading}
                        />
                        <label htmlFor="login-terms" className="text-[9px] text-[#666] leading-relaxed tracking-wide">
                            {t('auth.acceptTerms')}
                        </label>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading || !agreedToTerms}
                        className="w-full py-3 bg-white hover:bg-[#f8f9fa] border border-[#dadce0] text-[#3c4043] text-sm font-medium rounded-md flex items-center justify-center gap-3 transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:shadow-sm"
                    >
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        {t('auth.googleAccess')}
                    </button>

                    <div className="text-center pt-6 border-t border-[#222]">
                        {regDisabled && (
                            <p className="text-[10px] text-amber-500/90 mb-3 font-bold uppercase tracking-wider">
                                {t('auth.registrationsDisabled')}
                            </p>
                        )}
                        {newRegistrationEnabled ? (
                            <p className="text-[9px] text-[#666] tracking-wide">
                                {t('auth.noCredentials')} <Link to="/register" className="text-[#968B74] font-bold hover:text-[#E6D2A8] uppercase transition-colors ml-1 border-b border-[#968B74]/30 hover:border-[#E6D2A8]">{t('auth.requestAccess')}</Link>
                            </p>
                        ) : (
                            <p className="text-[9px] text-[#666] tracking-wide">
                                {t('auth.noCredentials')} <span className="text-[#555]">{t('auth.requestAccess')}</span>
                            </p>
                        )}
                    </div>
                </div>
                
                <p className="text-center text-[8px] text-[#444] uppercase tracking-[0.2em] font-mono opacity-50">
                    {t('auth.restrictedArea')}
                </p>
            </div>
        </div>
    );
};

export default Login;
