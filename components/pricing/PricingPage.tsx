import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { PRICING_TIERS } from '../../config/pricingConfig';

const PricingPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const TIER_NAMES: Record<string, string> = {
        starter: t('pricing.tierStarter'),
        standard: t('pricing.tierStandard'),
        professional: t('pricing.tierProfessional'),
        enterprise: t('pricing.tierEnterprise'),
    };
    const [loading, setLoading] = useState<string | null>(null);

    const handlePurchase = async (tier: (typeof PRICING_TIERS)[number]) => {
        if (!currentUser) {
            navigate('/login');
            return;
        }
        setLoading(tier.id);
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch('/api/lemonsqueezy/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    variantId: tier.variantId,
                    userId: currentUser.uid,
                    userEmail: currentUser.email || '',
                    points: tier.totalPoints,
                }),
            });
            const data = await res.json();
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
                return;
            }
            throw new Error(data.error || t('pricing.checkoutError'));
        } catch (error) {
            console.error('Payment error:', error);
            setLoading(null);
            alert(error instanceof Error ? error.message : t('pricing.paymentError'));
        }
    };

    return (
        <div className="min-h-screen relative overflow-hidden pt-40 pb-24">
             {/* Background */}
             <div className="premium-bg-wrapper">
                <div className="premium-wave-1"></div>
                <div className="premium-wave-2"></div>
                <div className="premium-wave-3"></div>
                <div className="premium-texture"></div>
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10 animate-fadeUp">
                
                {/* Header */}
                <div className="text-center mb-24 space-y-8">
                    <h1 className="text-5xl md:text-7xl font-serif text-[#E0E0E0] tracking-tight">
                        {t('pricing.investInTruth')} <span className="italic text-bronze-gradient">{t('pricing.investInTruthHighlight')}</span>
                    </h1>
                    <p className="text-[#888] text-xs uppercase tracking-[0.2em] max-w-2xl mx-auto leading-relaxed border-t border-[#333] pt-6 inline-block px-10">
                        {t('pricing.subtitle')}
                    </p>
                </div>

                {/* Cards Grid — 4 карти от pricingConfig */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20 max-w-6xl mx-auto">
                    {PRICING_TIERS.map((tier) => (
                        <div
                            key={tier.id}
                            className={`editorial-card p-6 space-y-6 relative group transition-all duration-500 hover:-translate-y-2 flex flex-col ${tier.popular ? 'border-[#968B74]/40 bg-[#252525]' : 'bg-[#1E1E1E]'}`}
                        >
                            {tier.popular && (
                                <>
                                    <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-[#5E5646] via-[#C4B091] to-[#5E5646]"></div>
                                    <div className="absolute top-3 left-1/2 -translate-x-1/2">
                                        <span className="inline-block bg-[#968B74]/20 text-[#C4B091] text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-[#968B74]/40">{t('pricing.bestValue')}</span>
                                    </div>
                                </>
                            )}
                            
                            <div className="text-center space-y-3 pt-4">
                                <h3 className="text-[10px] font-bold text-[#666] uppercase tracking-[0.3em]">{TIER_NAMES[tier.id] ?? tier.name}</h3>
                                <div className="flex items-baseline justify-center gap-0.5">
                                    <span className="text-4xl md:text-5xl font-serif text-[#f0f0f0] tracking-tighter">€{tier.priceEur}</span>
                                </div>
                                {tier.bonusPoints > 0 && (
                                    <span className="inline-block bg-[#968B74]/10 text-[#968B74] text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-[#968B74]/20">
                                        {t('pricing.bonusPoints', { count: tier.bonusPoints })}
                                    </span>
                                )}
                            </div>

                            <div className="py-6 border-y border-[#333] flex-1">
                                <ul className="space-y-3">
                                    {tier.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-center gap-3 text-xs text-[#aaa] tracking-wide">
                                            <span className="w-1 h-1 bg-[#968B74] rounded-full shadow-[0_0_5px_#968B74] flex-shrink-0"></span>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="space-y-4">
                                <div className="text-center">
                                    <p className="text-2xl font-serif text-bronze-gradient">{tier.totalPoints.toLocaleString('bg-BG')}</p>
                                    <p className="text-[9px] text-[#555] uppercase tracking-[0.3em] mt-1">{t('pricing.totalPoints')}</p>
                                </div>
                                <button
                                    onClick={() => handlePurchase(tier)}
                                    disabled={loading !== null}
                                    className={`w-full py-3 text-[10px] font-black uppercase tracking-[0.25em] transition-all ${tier.popular ? 'btn-luxury-solid rounded-sm' : 'btn-luxury rounded-sm hover:text-[#C4B091] hover:border-[#C4B091]'}`}
                                >
                                    {loading === tier.id ? t('pricing.processing') : t('pricing.choosePlan')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Badges */}
                <div className="flex justify-center gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                     <span className="text-[9px] font-bold text-[#666] uppercase tracking-widest">{t('pricing.secureSsl')}</span>
                     <span className="text-[9px] font-bold text-[#666] uppercase tracking-widest">{t('pricing.encryptedPayments')}</span>
                     <span className="text-[9px] font-bold text-[#666] uppercase tracking-widest">{t('pricing.instantActivation')}</span>
                </div>
            </div>
        </div>
    );
};

export default PricingPage;
