import React from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { 
    Youtube, Link, Archive, Share2, Download, Globe, 
    CreditCard, Smartphone, CheckCircle2, MessageSquareQuote, 
    Hand, FileText, Eye, User, Mic, VenetianMask, Brain, 
    Play, ShieldCheck, Zap, Activity, Cpu
} from 'lucide-react';

const FeaturesPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const isBg = i18n.language === 'bg';

    const deepTabs = isBg ? [
        { id: 'summary', icon: <Activity size={20} />, title: "Обзор", desc: "Обща оценка на достоверността и ключови показатели." },
        { id: 'claims', icon: <MessageSquareQuote size={20} />, title: "Твърдения", desc: "Извличане и верификация на всяко конкретно твърдение." },
        { id: 'manipulation', icon: <Hand size={20} />, title: "Манипулации", desc: "Разкриване на пропагандни и манипулативни техники." },
        { id: 'report', icon: <FileText size={20} />, title: "Експертен доклад", desc: "Синтезиран професионален разследващ доклад." },
        { id: 'visual', icon: <Eye size={20} />, title: "Визуален анализ", desc: "Анализ на визуалните внушения и монтажни техники." },
        { id: 'bodyLanguage', icon: <User size={20} />, title: "Език на тялото", desc: "Дълбок анализ на невербалната комуникация." },
        { id: 'vocal', icon: <Mic size={20} />, title: "Вокален анализ", desc: "Изследване на тона, тембъра и емоционалния заряд." },
        { id: 'deception', icon: <VenetianMask size={20} />, title: "Измамни модели", desc: "Идентифициране на опити за подвеждане и дезинформация." },
        { id: 'psychological', icon: <Brain size={20} />, title: "Психология", desc: "Анализ на психологическото въздействие върху аудиторията." }
    ] : [
        { id: 'summary', icon: <Activity size={20} />, title: "Overview", desc: "Overall credibility assessment and key metrics." },
        { id: 'claims', icon: <MessageSquareQuote size={20} />, title: "Claims", desc: "Extraction and verification of every specific claim." },
        { id: 'manipulation', icon: <Hand size={20} />, title: "Manipulations", desc: "Revealing propaganda and manipulative techniques." },
        { id: 'report', icon: <FileText size={20} />, title: "Expert Report", desc: "Synthesized professional investigative report." },
        { id: 'visual', icon: <Eye size={20} />, title: "Visual Analysis", desc: "Analysis of visual cues and editing techniques." },
        { id: 'bodyLanguage', icon: <User size={20} />, title: "Body Language", desc: "Deep analysis of non-verbal communication." },
        { id: 'vocal', icon: <Mic size={20} />, title: "Vocal Analysis", desc: "Examination of tone, timbre, and emotional charge." },
        { id: 'deception', icon: <VenetianMask size={20} />, title: "Deception Patterns", desc: "Identifying attempts to mislead and misinform." },
        { id: 'psychological', icon: <Brain size={20} />, title: "Psychology", desc: "Analysis of the psychological impact on the audience." }
    ];

    const mainFeatures = isBg ? [
        { title: "Видео анализ (YouTube)", description: "DCGE двигателят автоматично извлича транскрипции, метаданни и визуални елементи от YouTube видеоклипове.", icon: <Youtube size={24} className="text-[#968B74]" /> },
        { title: "Одит на статии (Link Audit)", description: "Проверка на фактическата точност, профил на автора и медията, анализ на clickbait и реторика.", icon: <Link size={24} className="text-[#968B74]" /> },
        { title: "Личен архив", description: "Запазвайте вашите анализи в лична библиотека за по-късен преглед и управление.", icon: <Archive size={24} className="text-[#968B74]" /> },
        { title: "Експорт и Споделяне", description: "Генерирайте публични линкове или сваляйте докладите като PNG за социални мрежи.", icon: <Share2 size={24} className="text-[#968B74]" /> }
    ] : [
        { title: "Video Analysis (YouTube)", description: "The DCGE engine automatically extracts transcripts, metadata, and visual elements from YouTube videos.", icon: <Youtube size={24} className="text-[#968B74]" /> },
        { title: "Article Audit (Link Audit)", description: "Checking factual accuracy, author and media profile, clickbait analysis, and rhetoric.", icon: <Link size={24} className="text-[#968B74]" /> },
        { title: "Personal Archive", description: "Save your analyses in a personal library for later review and management.", icon: <Archive size={24} className="text-[#968B74]" /> },
        { title: "Export and Share", description: "Generate public links or download reports as PNG for social media.", icon: <Share2 size={24} className="text-[#968B74]" /> }
    ];

    return (
        <div className="min-h-screen relative overflow-hidden pt-48 pb-24 max-md:pt-32">
            <Helmet>
                <title>{isBg ? 'Възможности и Технология | FACTCHECKER AI' : 'Features and Technology | FACTCHECKER AI'}</title>
                <meta name="description" content={isBg ? 'Разгледайте всички мощни функции на FactChecker AI и нашата DCGE технология за медиен одит.' : 'Explore all the powerful features of FactChecker AI and our DCGE technology for media audit.'} />
            </Helmet>

            {/* Background */}
            <div className="premium-bg-wrapper">
                <div className="premium-wave-1 opacity-20"></div>
                <div className="premium-wave-2 opacity-10"></div>
                <div className="premium-texture"></div>
            </div>

            <div className="max-w-6xl mx-auto px-6 relative z-10">
                {/* Hero Section */}
                <div className="text-center mb-24 animate-fadeUp">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <span className="h-[1px] w-12 bg-[#968B74]/60"></span>
                        <span className="text-[10px] font-bold text-[#C4B091] uppercase tracking-[0.4em]">
                            {isBg ? 'ВЪЗМОЖНОСТИ' : 'FEATURES'}
                        </span>
                        <span className="h-[1px] w-12 bg-[#968B74]/60"></span>
                    </div>
                    <h1 className="text-6xl md:text-7xl font-serif text-[#E0E0E0] tracking-tighter mb-8">
                        {isBg ? 'Екосистема за' : 'Ecosystem for'} <span className="text-bronze-gradient">{isBg ? 'Истината' : 'the Truth'}</span>
                    </h1>
                    <p className="text-xs text-[#888] max-w-2xl mx-auto uppercase tracking-[0.3em] leading-loose">
                        {isBg ? 'Deep Contextual Generative Engine (DCGE) — Пълният набор от инструменти за медиен одит.' : 'Deep Contextual Generative Engine (DCGE) — The complete set of tools for media audit.'}
                    </p>
                </div>

                {/* Video Presentation Section */}
                <div className="mb-32 animate-fadeUp" style={{ animationDelay: '0.2s' }}>
                    <div className="editorial-card p-4 bg-[#1A1A1A]/60 border-[#333] relative group overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#968B74]/40 to-transparent"></div>
                        <div className="aspect-video relative rounded-sm overflow-hidden bg-black">
                            <iframe
                                className="absolute top-0 left-0 w-full h-full opacity-90 group-hover:opacity-100 transition-opacity duration-700"
                                src="https://www.youtube.com/embed/rOFuiEggj_s?autoplay=0&controls=1&rel=0&modestbranding=1"
                                title="FactChecker AI Presentation"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                        <div className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-full bg-[#968B74]/10">
                                    <Play size={16} className="text-[#968B74]" />
                                </div>
                                <span className="text-[10px] font-bold text-[#888] uppercase tracking-[0.2em]">
                                    {isBg ? 'Видео презентация на платформата' : 'Platform Video Presentation'}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <div className="w-1 h-1 rounded-full bg-[#968B74]/40 animate-pulse"></div>
                                <div className="w-1 h-1 rounded-full bg-[#968B74]/40 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-1 h-1 rounded-full bg-[#968B74]/40 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-32">
                    {mainFeatures.map((feature, index) => (
                        <div 
                            key={index} 
                            className="editorial-card p-8 bg-[#1A1A1A]/40 border-[#333] hover:border-[#968B74]/40 transition-all duration-500 group animate-fadeUp"
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            <div className="w-12 h-12 rounded-full bg-[#222] flex items-center justify-center mb-8 border border-[#333] group-hover:border-[#968B74]/40 transition-colors">
                                {feature.icon}
                            </div>
                            <h3 className="text-lg font-serif text-[#E0E0E0] mb-4 group-hover:text-[#C4B091] transition-colors">
                                {feature.title}
                            </h3>
                            <p className="text-sm text-[#666] leading-relaxed group-hover:text-[#888] transition-colors">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Deep Analysis Tabs Detail */}
                <div className="mb-32 animate-fadeUp" style={{ animationDelay: '0.4s' }}>
                    <div className="text-center mb-16">
                        <div className="flex items-center justify-center gap-3 mb-6">
                            <Zap size={18} className="text-[#968B74]" />
                            <span className="text-[10px] font-bold text-[#968B74] uppercase tracking-widest">
                                {isBg ? 'DEEP АНАЛИЗ ПОД ЛУПА' : 'DEEP ANALYSIS UNDER THE HOOD'}
                            </span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-serif text-[#E0E0E0] mb-8">
                            {isBg ? 'Мултимодална' : 'Multimodal'} <span className="text-bronze-gradient">{isBg ? 'Дълбочина' : 'Depth'}</span>
                        </h2>
                        <p className="text-sm text-[#888] max-w-2xl mx-auto leading-relaxed">
                            {isBg ? 'Нашият Deep режим не просто проверява факти — той дисектира съдържанието през 9 различни аналитични измерения.' : 'Our Deep mode doesn\'t just check facts — it dissects content through 9 different analytical dimensions.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {deepTabs.map((tab, index) => (
                            <div 
                                key={index} 
                                className="editorial-card p-6 bg-[#1A1A1A]/30 border-[#333] hover:bg-[#222]/40 transition-all duration-500 flex gap-6 group"
                            >
                                <div className="shrink-0 w-12 h-12 rounded-lg bg-[#222] flex items-center justify-center border border-[#333] group-hover:border-[#968B74]/30 transition-colors text-[#666] group-hover:text-[#968B74]">
                                    {tab.icon}
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-[#C4B091] uppercase tracking-widest mb-2">
                                        {tab.title}
                                    </h4>
                                    <p className="text-xs text-[#777] leading-relaxed group-hover:text-[#999] transition-colors">
                                        {tab.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Technology Section */}
                <div className="editorial-card p-12 bg-gradient-to-br from-[#1A1A1A] to-[#222] border-[#333] relative overflow-hidden mb-32 animate-fadeUp">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-[#968B74]/5 blur-[120px] -mr-48 -mt-48"></div>
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <Cpu size={18} className="text-[#968B74]" />
                                <span className="text-[10px] font-bold text-[#968B74] uppercase tracking-widest">
                                    {isBg ? 'DCGE ТЕХНОЛОГИЯ' : 'DCGE TECHNOLOGY'}
                                </span>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-serif text-[#E0E0E0] mb-8 leading-tight">
                                {isBg ? 'Многоагентна система от' : 'Multi-agent system of'} <br />
                                <span className="text-bronze-gradient">{isBg ? 'най-висок клас' : 'highest class'}</span>
                            </h2>
                            <p className="text-sm text-[#888] leading-relaxed mb-10">
                                {isBg ? 'DCGE (Deep Contextual Generative Engine) е нашата собствена архитектура, която координира десетки специализирани AI агенти. Те работят в синхрон, за да осигурят прецизност, която обикновените модели не могат да постигнат сами.' : 'DCGE (Deep Contextual Generative Engine) is our proprietary architecture that coordinates dozens of specialized AI agents. They work in sync to provide precision that ordinary models cannot achieve alone.'}
                            </p>
                            <div className="flex gap-8">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck size={20} className="text-[#968B74]" />
                                    <span className="text-[10px] font-bold text-[#E0E0E0] uppercase tracking-widest">100% {isBg ? 'ОБЕКТИВНОСТ' : 'OBJECTIVITY'}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Zap size={20} className="text-[#968B74]" />
                                    <span className="text-[10px] font-bold text-[#E0E0E0] uppercase tracking-widest">{isBg ? 'РЕАЛНО ВРЕМЕ' : 'REAL TIME'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 editorial-card bg-[#111] border-[#333] text-center">
                                <div className="text-3xl font-serif text-[#C4B091] mb-2">11</div>
                                <div className="text-[8px] text-[#555] uppercase tracking-widest">{isBg ? 'МЕТРИКИ ЗА АНАЛИЗ' : 'ANALYSIS METRICS'}</div>
                            </div>
                            <div className="p-6 editorial-card bg-[#111] border-[#333] text-center">
                                <div className="text-3xl font-serif text-[#C4B091] mb-2">100+</div>
                                <div className="text-[8px] text-[#555] uppercase tracking-widest">{isBg ? 'ПРОВЕРЕНИ ИЗТОЧНИКА' : 'VERIFIED SOURCES'}</div>
                            </div>
                            <div className="p-6 editorial-card bg-[#111] border-[#333] text-center">
                                <div className="text-3xl font-serif text-[#C4B091] mb-2">24/7</div>
                                <div className="text-[8px] text-[#555] uppercase tracking-widest">{isBg ? 'МОНИТОРИНГ' : 'MONITORING'}</div>
                            </div>
                            <div className="p-6 editorial-card bg-[#111] border-[#333] text-center">
                                <div className="text-3xl font-serif text-[#C4B091] mb-2">API</div>
                                <div className="text-[8px] text-[#555] uppercase tracking-widest">{isBg ? 'ГОТОВА ИНТЕГРАЦИЯ' : 'READY INTEGRATION'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="text-center animate-fadeUp" style={{ animationDelay: '0.6s' }}>
                    <div className="editorial-card p-16 bg-gradient-to-b from-[#1A1A1A] to-transparent border-[#333] max-w-3xl mx-auto">
                        <h2 className="text-3xl font-serif text-[#E0E0E0] mb-8">
                            {isBg ? 'Готови ли сте за професионален одит?' : 'Ready for a professional audit?'}
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
