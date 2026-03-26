import React from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Youtube, Link, Archive, Share2, Download, Globe, CreditCard, Smartphone, CheckCircle2 } from 'lucide-react';

const FeaturesPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const isBg = i18n.language === 'bg';

    const features = isBg ? [
        {
            title: "Видео анализ (YouTube)",
            description: "Автоматично извличане на твърдения, манипулации и аналитични метрики от всяко YouTube видео.",
            icon: <Youtube size={24} className="text-[#968B74]" />
        },
        {
            title: "Одит на статии (Link Audit)",
            description: "Проверка на фактическата точност, профил на автора и медията, анализ на заглавието (clickbait) и реторика.",
            icon: <Link size={24} className="text-[#968B74]" />
        },
        {
            title: "Личен архив",
            description: "Запазвайте вашите анализи в лична библиотека за по-късен преглед и управление.",
            icon: <Archive size={24} className="text-[#968B74]" />
        },
        {
            title: "Споделяне на доклади",
            description: "Генерирайте уникални публични линкове за споделяне на вашите разследвания с други хора.",
            icon: <Share2 size={24} className="text-[#968B74]" />
        },
        {
            title: "Експорт в PNG",
            description: "Сваляйте пълните аналитични доклади като професионални изображения за презентации и социални мрежи.",
            icon: <Download size={24} className="text-[#968B74]" />
        },
        {
            title: "Многоезична поддръжка",
            description: "Пълен интерфейс и анализи на български и английски език за международна употреба.",
            icon: <Globe size={24} className="text-[#968B74]" />
        },
        {
            title: "Гъвкави планове",
            description: "Система от точки с различни абонаменти, адаптирани за индивидуални потребители и организации.",
            icon: <CreditCard size={24} className="text-[#968B74]" />
        },
        {
            title: "Мобилна версия",
            description: "Пълна функционалност и адаптивен дизайн за телефони и таблети, за да сте информирани навсякъде.",
            icon: <Smartphone size={24} className="text-[#968B74]" />
        }
    ] : [
        {
            title: "Video Analysis (YouTube)",
            description: "Automatic extraction of claims, manipulations, and analytical metrics from any YouTube video.",
            icon: <Youtube size={24} className="text-[#968B74]" />
        },
        {
            title: "Article Audit (Link Audit)",
            description: "Checking factual accuracy, author and media profile, headline analysis (clickbait), and rhetoric.",
            icon: <Link size={24} className="text-[#968B74]" />
        },
        {
            title: "Personal Archive",
            description: "Save your analyses in a personal library for later review and management.",
            icon: <Archive size={24} className="text-[#968B74]" />
        },
        {
            title: "Report Sharing",
            description: "Generate unique public links to share your investigations with others.",
            icon: <Share2 size={24} className="text-[#968B74]" />
        },
        {
            title: "PNG Export",
            description: "Download full analytical reports as professional images for presentations and social media.",
            icon: <Download size={24} className="text-[#968B74]" />
        },
        {
            title: "Multilingual Support",
            description: "Full interface and analysis in Bulgarian and English for international use.",
            icon: <Globe size={24} className="text-[#968B74]" />
        },
        {
            title: "Flexible Plans",
            description: "Points system with various subscriptions tailored for individual users and organizations.",
            icon: <CreditCard size={24} className="text-[#968B74]" />
        },
        {
            title: "Mobile Version",
            description: "Full functionality and responsive design for phones and tablets, keeping you informed anywhere.",
            icon: <Smartphone size={24} className="text-[#968B74]" />
        }
    ];

    return (
        <div className="min-h-screen relative overflow-hidden pt-48 pb-24 max-md:pt-32">
            <Helmet>
                <title>{isBg ? 'Възможности | FACTCHECKER AI' : 'Features | FACTCHECKER AI'}</title>
                <meta name="description" content={isBg ? 'Разгледайте всички мощни функции на FactChecker AI за медиен одит и фактчекинг.' : 'Explore all the powerful features of FactChecker AI for media audit and fact-checking.'} />
            </Helmet>

            {/* Background */}
            <div className="premium-bg-wrapper">
                <div className="premium-wave-1 opacity-20"></div>
                <div className="premium-wave-2 opacity-10"></div>
                <div className="premium-texture"></div>
            </div>

            <div className="max-w-6xl mx-auto px-6 relative z-10">
                <div className="text-center mb-24 animate-fadeUp">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <span className="h-[1px] w-12 bg-[#968B74]/60"></span>
                        <span className="text-[10px] font-bold text-[#C4B091] uppercase tracking-[0.4em]">
                            {isBg ? 'ВЪЗМОЖНОСТИ' : 'FEATURES'}
                        </span>
                        <span className="h-[1px] w-12 bg-[#968B74]/60"></span>
                    </div>
                    <h1 className="text-6xl md:text-7xl font-serif text-[#E0E0E0] tracking-tighter mb-8">
                        {isBg ? 'Всичко за' : 'Everything for'} <span className="text-bronze-gradient">{isBg ? 'Медийния Одит' : 'Media Audit'}</span>
                    </h1>
                    <p className="text-xs text-[#888] max-w-2xl mx-auto uppercase tracking-[0.3em] leading-loose">
                        {isBg ? 'От видео анализ до дълбок одит на статии — пълният набор от инструменти за истината.' : 'From video analysis to deep article audit — the complete set of tools for the truth.'}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <div 
                            key={index} 
                            className="editorial-card p-10 bg-[#1A1A1A]/40 border-[#333] hover:border-[#968B74]/40 transition-all duration-500 group animate-fadeUp"
                            style={{ animationDelay: `${index * 0.05}s` }}
                        >
                            <div className="flex items-start justify-between mb-10">
                                <div className="p-3 rounded-xl bg-[#222] border border-[#333] group-hover:border-[#968B74]/40 transition-colors">
                                    {feature.icon}
                                </div>
                                <CheckCircle2 size={16} className="text-[#333] group-hover:text-[#968B74]/40 transition-colors" />
                            </div>
                            <h3 className="text-xl font-serif text-[#E0E0E0] mb-4 group-hover:text-[#C4B091] transition-colors">
                                {feature.title}
                            </h3>
                            <p className="text-sm text-[#666] leading-relaxed group-hover:text-[#888] transition-colors">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Call to Action */}
                <div className="mt-32 text-center animate-fadeUp" style={{ animationDelay: '0.5s' }}>
                    <div className="editorial-card p-16 bg-gradient-to-b from-[#1A1A1A] to-transparent border-[#333] max-w-3xl mx-auto">
                        <h2 className="text-3xl font-serif text-[#E0E0E0] mb-8">
                            {isBg ? 'Готови ли сте да проверите първия си линк?' : 'Ready to verify your first link?'}
                        </h2>
                        <button 
                            onClick={() => window.location.href = '/'}
                            className="px-12 py-5 bg-[#968B74] text-[#1a1a1a] text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-[#C4B091] transition-all rounded-sm shadow-[0_10px_30px_rgba(150,139,116,0.2)]"
                        >
                            {isBg ? 'ЗАПОЧНЕТЕ СЕГА' : 'START NOW'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeaturesPage;
