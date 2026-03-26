import React from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Cpu, Search, FileText, Share2, Activity, Database } from 'lucide-react';

const HowItWorksPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const isBg = i18n.language === 'bg';

    const steps = isBg ? [
        {
            title: "Интелигентно извличане",
            description: "DCGE двигателят автоматично извлича транскрипции, метаданни и визуални елементи от YouTube видеоклипове или статии.",
            icon: <Database size={24} className="text-[#968B74]" />
        },
        {
            title: "Дълбок контекстуален анализ",
            description: "Изкуственият интелект Gemini 2.5 Flash анализира езика, тона и логическата структура на съдържанието.",
            icon: <Cpu size={24} className="text-[#968B74]" />
        },
        {
            title: "Глобална верификация",
            description: "Всяко твърдение се проверява срещу хиляди надеждни източници и бази данни в реално време чрез Google Search.",
            icon: <Search size={24} className="text-[#968B74]" />
        },
        {
            title: "Синтезиран доклад",
            description: "Получавате професионален разследващ доклад с вердикти, манипулативни техники и аналитични метрики.",
            icon: <FileText size={24} className="text-[#968B74]" />
        }
    ] : [
        {
            title: "Smart Extraction",
            description: "The DCGE engine automatically extracts transcripts, metadata, and visual elements from YouTube videos or articles.",
            icon: <Database size={24} className="text-[#968B74]" />
        },
        {
            title: "Deep Contextual Analysis",
            description: "Gemini 2.5 Flash AI analyzes the language, tone, and logical structure of the content.",
            icon: <Cpu size={24} className="text-[#968B74]" />
        },
        {
            title: "Global Verification",
            description: "Every claim is checked against thousands of reliable sources and databases in real-time via Google Search.",
            icon: <Search size={24} className="text-[#968B74]" />
        },
        {
            title: "Synthesized Report",
            description: "You receive a professional investigative report with verdicts, manipulative techniques, and analytical metrics.",
            icon: <FileText size={24} className="text-[#968B74]" />
        }
    ];

    return (
        <div className="min-h-screen relative overflow-hidden pt-48 pb-24 max-md:pt-32">
            <Helmet>
                <title>{isBg ? 'Как работи | FACTCHECKER AI' : 'How It Works | FACTCHECKER AI'}</title>
                <meta name="description" content={isBg ? 'Научете как нашата DCGE технология и AI анализират медийното съдържание.' : 'Learn how our DCGE technology and AI analyze media content.'} />
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
                            {isBg ? 'ТЕХНОЛОГИЯТА' : 'THE TECHNOLOGY'}
                        </span>
                        <span className="h-[1px] w-12 bg-[#968B74]/60"></span>
                    </div>
                    <h1 className="text-6xl md:text-7xl font-serif text-[#E0E0E0] tracking-tighter mb-8">
                        {isBg ? 'Одит на' : 'Audit of'} <span className="text-bronze-gradient">{isBg ? 'Истинността' : 'the Truth'}</span>
                    </h1>
                    <p className="text-xs text-[#888] max-w-2xl mx-auto uppercase tracking-[0.3em] leading-loose">
                        {isBg ? 'Deep Contextual Generative Engine (DCGE) — следващо поколение фактчекинг' : 'Deep Contextual Generative Engine (DCGE) — next-generation fact-checking'}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-32">
                    {steps.map((step, index) => (
                        <div 
                            key={index} 
                            className="editorial-card p-8 bg-[#1A1A1A]/40 border-[#333] hover:border-[#968B74]/40 transition-all duration-500 group animate-fadeUp"
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            <div className="w-12 h-12 rounded-full bg-[#222] flex items-center justify-center mb-8 border border-[#333] group-hover:border-[#968B74]/40 transition-colors">
                                {step.icon}
                            </div>
                            <div className="text-[10px] font-bold text-[#968B74] uppercase tracking-widest mb-4">
                                0{index + 1}.
                            </div>
                            <h3 className="text-lg font-serif text-[#E0E0E0] mb-4 group-hover:text-[#C4B091] transition-colors">
                                {step.title}
                            </h3>
                            <p className="text-sm text-[#666] leading-relaxed group-hover:text-[#888] transition-colors">
                                {step.description}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Engine Visualization Placeholder */}
                <div className="editorial-card p-12 bg-gradient-to-br from-[#1A1A1A] to-[#222] border-[#333] relative overflow-hidden animate-fadeUp" style={{ animationDelay: '0.4s' }}>
                    <div className="absolute top-0 right-0 w-96 h-96 bg-[#968B74]/5 blur-[120px] -mr-48 -mt-48"></div>
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <Activity size={18} className="text-[#968B74]" />
                                <span className="text-[10px] font-bold text-[#968B74] uppercase tracking-widest">
                                    {isBg ? 'АНАЛИТИЧНИ МЕТРИКИ' : 'ANALYTICAL METRICS'}
                                </span>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-serif text-[#E0E0E0] mb-8 leading-tight">
                                {isBg ? 'Мултимодален анализ в' : 'Multimodal analysis in'} <br />
                                <span className="text-bronze-gradient">{isBg ? 'реално време' : 'real time'}</span>
                            </h2>
                            <p className="text-sm text-[#888] leading-relaxed mb-10">
                                {isBg ? 'Нашата система не просто чете думите. Тя анализира тона на гласа, израженията на лицето (в Deep режим) и контекста на всяко твърдение, за да изгради цялостен профил на достоверността.' : 'Our system doesn\'t just read words. It analyzes voice tone, facial expressions (in Deep mode), and the context of every claim to build a complete credibility profile.'}
                            </p>
                            <div className="flex gap-6">
                                <div className="text-center">
                                    <div className="text-2xl font-serif text-[#C4B091] mb-1">11</div>
                                    <div className="text-[8px] text-[#555] uppercase tracking-widest">{isBg ? 'МЕТРИКИ' : 'METRICS'}</div>
                                </div>
                                <div className="w-[1px] h-10 bg-[#333]"></div>
                                <div className="text-center">
                                    <div className="text-2xl font-serif text-[#C4B091] mb-1">100+</div>
                                    <div className="text-[8px] text-[#555] uppercase tracking-widest">{isBg ? 'ИЗТОЧНИКА' : 'SOURCES'}</div>
                                </div>
                                <div className="w-[1px] h-10 bg-[#333]"></div>
                                <div className="text-center">
                                    <div className="text-2xl font-serif text-[#C4B091] mb-1">AI</div>
                                    <div className="text-[8px] text-[#555] uppercase tracking-widest">{isBg ? 'GEMINI 2.5' : 'GEMINI 2.5'}</div>
                                </div>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="aspect-video bg-[#111] rounded-lg border border-[#333] flex items-center justify-center p-8 overflow-hidden">
                                <div className="w-full h-full relative flex items-center justify-center">
                                    <div className="absolute w-48 h-48 border border-[#968B74]/20 rounded-full animate-pulse"></div>
                                    <div className="absolute w-64 h-64 border border-[#968B74]/10 rounded-full animate-ping"></div>
                                    <Cpu size={48} className="text-[#968B74] opacity-40" />
                                </div>
                            </div>
                            <div className="absolute -bottom-4 -right-4 p-4 editorial-card bg-[#222] border-[#968B74]/20 flex items-center gap-3">
                                <Share2 size={14} className="text-[#968B74]" />
                                <span className="text-[8px] font-bold text-[#888] uppercase tracking-widest">{isBg ? 'ГОТОВ ЗА СПОДЕЛЯНЕ' : 'READY TO SHARE'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HowItWorksPage;
