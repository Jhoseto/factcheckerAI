import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PRICING_TIERS } from '../../config/pricingConfig';

// Use PRICING_TIERS from centralized config
const pricingTiers = PRICING_TIERS.map(tier => ({
    ...tier,
    price: tier.priceEur,
    points: tier.totalPoints,
    bonus: tier.bonusPoints
}));

const PricingPage: React.FC = () => {
    const [loading, setLoading] = useState<string | null>(null);
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();

    const handlePurchase = async (tier: typeof pricingTiers[0]) => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        setLoading(tier.id);

        try {
            // Create checkout with Lemon Squeezy
            const response = await fetch('/api/lemonsqueezy/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    variantId: tier.variantId,
                    userId: currentUser.uid,
                    userEmail: currentUser.email,
                    productName: tier.name,
                    points: tier.points
                })
            });

            const data = await response.json();

            if (data.checkoutUrl) {
                // Redirect to Lemon Squeezy checkout
                window.location.href = data.checkoutUrl;
            } else {
                throw new Error('Failed to create checkout');
            }
        } catch (error) {
            console.error('[Purchase Error]', error);
            alert('Възникна грешка при плащането. Моля, опитайте отново или се свържете с поддръжката.');
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-slate-50 px-4 py-12">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16 space-y-6 animate-fadeIn">
                    <div className="inline-block">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="h-[1.5px] w-8 bg-amber-900/60"></span>
                            <span className="text-[10px] font-black text-amber-900 uppercase tracking-[0.4em]">
                                Инвестирайте в истината
                            </span>
                            <span className="h-[1.5px] w-8 bg-amber-900/60"></span>
                        </div>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-tight serif italic">
                        Изберете вашия{' '}
                        <span className="text-amber-900 relative">
                            план
                            <span className="absolute -bottom-2 left-0 right-0 h-1 bg-amber-900/20"></span>
                        </span>
                    </h1>

                    <p className="text-slate-600 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                        Получете достъп до най-мощния AI анализатор на информация.
                        Всички планове включват пълен достъп до всички функции.
                    </p>

                    <button
                        onClick={() => navigate('/')}
                        className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors uppercase tracking-wider"
                    >
                        ← Назад към анализатора
                    </button>
                </div>

                {/* Security Badge */}
                <div className="max-w-md mx-auto mb-8 editorial-card p-4 border-l-4 border-l-emerald-600">
                    <div className="flex items-center gap-3">
                        <svg className="w-6 h-6 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <p className="text-xs font-black text-slate-900 uppercase">Сигурно плащане</p>
                            <p className="text-[10px] text-slate-600">Защитено от Lemon Squeezy • SSL криптиране</p>
                        </div>
                    </div>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {pricingTiers.map((tier, index) => (
                        <div
                            key={tier.id}
                            className={`editorial-card p-8 space-y-6 relative overflow-hidden group hover:shadow-2xl transition-all duration-300 animate-slideUp ${tier.popular ? 'border-4 border-amber-900 scale-105 md:scale-110 z-10' : 'border-2 border-slate-200'
                                }`}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            {/* Popular Badge */}
                            {tier.popular && (
                                <div className="absolute top-0 right-0 bg-amber-900 text-white px-4 py-1 text-[9px] font-black uppercase tracking-widest transform rotate-0">
                                    🔥 Най-изгодно
                                </div>
                            )}

                            {/* Tier Name */}
                            <div className="space-y-2">
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                                    {tier.name}
                                </h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-5xl font-black text-slate-900 tracking-tighter">
                                        €{tier.price}
                                    </span>
                                </div>
                                {tier.bonus > 0 && (
                                    <div className="inline-block bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">
                                            +{tier.bonus} Bonus точки
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Points */}
                            <div className="p-6 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-sm border border-amber-200">
                                <div className="text-center space-y-2">
                                    <p className="text-[9px] font-black text-amber-900 uppercase tracking-widest">
                                        Получавате
                                    </p>
                                    <p className="text-4xl font-black text-amber-900 tracking-tighter">
                                        {tier.points.toLocaleString()}
                                    </p>
                                    <p className="text-xs font-bold text-amber-800 uppercase">точки</p>
                                </div>
                            </div>

                            {/* Features */}
                            <ul className="space-y-3">
                                {tier.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-sm">
                                        <span className="text-emerald-600 font-black mt-0.5 flex-shrink-0">✓</span>
                                        <span className="text-slate-700 font-medium leading-tight">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* CTA Button */}
                            <button
                                onClick={() => handlePurchase(tier)}
                                disabled={loading !== null}
                                className={`w-full p-4 text-xs font-black uppercase tracking-widest transition-all shadow-lg group-hover:shadow-xl ${tier.popular
                                    ? 'bg-amber-900 text-white hover:bg-amber-950 active:scale-95'
                                    : 'bg-slate-900 text-white hover:bg-black active:scale-95'
                                    } ${loading === tier.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {loading === tier.id ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        Обработване...
                                    </span>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                        </svg>
                                        Плати с карта
                                    </>
                                )}
                            </button>

                            {/* Estimated analyses */}
                            <p className="text-center text-[9px] text-slate-400 italic pt-2 border-t border-slate-100">
                                ~{Math.floor(tier.points / 10)} анализа
                            </p>
                        </div>
                    ))}
                </div>

                {/* Payment Methods */}
                <div className="max-w-2xl mx-auto mb-8 text-center">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Приемаме</p>
                    <div className="flex items-center justify-center gap-6 opacity-60">
                        <span className="text-2xl">💳</span>
                        <span className="text-sm font-bold text-slate-600">Visa</span>
                        <span className="text-sm font-bold text-slate-600">Mastercard</span>
                        <span className="text-sm font-bold text-slate-600">Amex</span>
                        <span className="text-sm font-bold text-slate-600">PayPal</span>
                    </div>
                </div>

                {/* FAQ / Info Section */}
                <div className="editorial-card p-8 md:p-12 space-y-8 bg-white border-t-4 border-t-amber-900 animate-fadeIn">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight text-center serif italic">
                        Често задавани въпроси
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider">
                                Как работят точките?
                            </h3>
                            <p className="text-sm text-slate-700 leading-relaxed">
                                Всеки анализ струва определен брой точки в зависимост от режима на анализ.
                                Точките се изваждат автоматично при започване на анализ.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider">
                                Имат ли точките срок на валидност?
                            </h3>
                            <p className="text-sm text-slate-700 leading-relaxed">
                                Не, точките нямат срок на валидност. Можете да ги използвате по всяко време.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider">
                                Мога ли да получа възстановяване?
                            </h3>
                            <p className="text-sm text-slate-700 leading-relaxed">
                                Да, предлагаме 14-дневна гаранция за връщане на парите без въпроси.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider">
                                Безопасно ли е плащането?
                            </h3>
                            <p className="text-sm text-slate-700 leading-relaxed">
                                Да, използваме Lemon Squeezy - сертифициран PCI DSS Level 1 payment процесор с пълно SSL криптиране.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
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

export default PricingPage;
