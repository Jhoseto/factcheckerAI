import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, HelpCircle, ShieldCheck, Zap, Globe, Lock } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

const FAQPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const isBg = i18n.language === 'bg';

    const faqs = isBg ? [
        {
            question: "Какво представлява FactChecker AI?",
            answer: "FactChecker AI е усъвършенствана платформа за медиен анализ, която използва изкуствен интелект (DCGE технология), за да проверява истинността на видеоклипове и статии. Ние помагаме на потребителите да разпознават дезинформация, манипулативни техники и пропаганда в реално време.",
            icon: <ShieldCheck className="text-[#968B74]" size={20} />
        },
        {
            question: "Как работи видео анализът?",
            answer: "Просто поставете линк към YouTube видео. Нашата система извлича транскрипцията, анализира аудиото и визуалните елементи (в Deep режим) и проверява всяко твърдение срещу глобални бази данни и надеждни източници.",
            icon: <Zap className="text-[#968B74]" size={20} />
        },
        {
            question: "Платена ли е услугата?",
            answer: "FactChecker AI работи със система от точки. Различните видове анализи консумират различен брой точки. Можете да закупите пакети с точки от нашата страница с цени, които са валидни за неограничен период от време.",
            icon: <Globe className="text-[#968B74]" size={20} />
        },
        {
            question: "Сигурни ли са моите данни?",
            answer: "Да, сигурността е наш приоритет. Всички анализи се обработват в защитена среда, а вашите лични данни и история на търсенията са криптирани и достъпни само за вас.",
            icon: <Lock className="text-[#968B74]" size={20} />
        }
    ] : [
        {
            question: "What is FactChecker AI?",
            answer: "FactChecker AI is an advanced media analysis platform that uses artificial intelligence (DCGE technology) to verify the truthfulness of videos and articles. We help users identify misinformation, manipulative techniques, and propaganda in real-time.",
            icon: <ShieldCheck className="text-[#968B74]" size={20} />
        },
        {
            question: "How does video analysis work?",
            answer: "Simply paste a link to a YouTube video. Our system extracts the transcript, analyzes audio and visual elements (in Deep mode), and verifies every claim against global databases and reliable sources.",
            icon: <Zap className="text-[#968B74]" size={20} />
        },
        {
            question: "Is the service paid?",
            answer: "FactChecker AI operates on a points-based system. Different types of analysis consume a different number of points. You can purchase points packages from our pricing page, which are valid for an unlimited period.",
            icon: <Globe className="text-[#968B74]" size={20} />
        },
        {
            question: "Is my data secure?",
            answer: "Yes, security is our priority. All analyses are processed in a secure environment, and your personal data and search history are encrypted and accessible only to you.",
            icon: <Lock className="text-[#968B74]" size={20} />
        }
    ];

    return (
        <div className="min-h-screen relative overflow-hidden pt-48 pb-24 max-md:pt-32">
            <Helmet>
                <title>{isBg ? 'Често задавани въпроси | FACTCHECKER AI' : 'FAQ | FACTCHECKER AI'}</title>
                <meta name="description" content={isBg ? 'Всичко, което трябва да знаете за FactChecker AI - как работи, цени и сигурност.' : 'Everything you need to know about FactChecker AI - how it works, pricing, and security.'} />
            </Helmet>

            {/* Background */}
            <div className="premium-bg-wrapper">
                <div className="premium-wave-1 opacity-20"></div>
                <div className="premium-wave-2 opacity-10"></div>
                <div className="premium-texture"></div>
            </div>

            <div className="max-w-4xl mx-auto px-6 relative z-10">
                <div className="text-center mb-16 animate-fadeUp">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <span className="h-[1px] w-8 bg-[#968B74]/60"></span>
                        <span className="text-[10px] font-bold text-[#C4B091] uppercase tracking-[0.3em]">
                            {isBg ? 'ПОМОЩЕН ЦЕНТЪР' : 'HELP CENTER'}
                        </span>
                        <span className="h-[1px] w-8 bg-[#968B74]/60"></span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-serif text-[#E0E0E0] tracking-tight mb-6">
                        {isBg ? 'Често задавани' : 'Frequently Asked'} <span className="text-bronze-gradient">{isBg ? 'въпроси' : 'Questions'}</span>
                    </h1>
                    <p className="text-sm text-[#888] max-w-xl mx-auto uppercase tracking-widest leading-relaxed">
                        {isBg ? 'Всичко, което трябва да знаете за нашата технология и услуги' : 'Everything you need to know about our technology and services'}
                    </p>
                </div>

                <div className="space-y-4 animate-fadeUp" style={{ animationDelay: '0.2s' }}>
                    {faqs.map((faq, index) => (
                        <div 
                            key={index}
                            className={`editorial-card transition-all duration-500 overflow-hidden ${openIndex === index ? 'bg-[#252525] border-[#968B74]/40 shadow-[0_10px_30px_rgba(0,0,0,0.3)]' : 'bg-[#1A1A1A]/40 border-[#333] hover:border-[#444]'}`}
                        >
                            <button 
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full px-8 py-6 flex items-center justify-between text-left"
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`p-2 rounded-lg transition-colors ${openIndex === index ? 'bg-[#968B74]/20' : 'bg-[#222]'}`}>
                                        {faq.icon}
                                    </div>
                                    <span className={`text-sm md:text-base font-serif tracking-wide transition-colors ${openIndex === index ? 'text-[#E0E0E0]' : 'text-[#A0A0A0]'}`}>
                                        {faq.question}
                                    </span>
                                </div>
                                <ChevronDown 
                                    className={`text-[#444] transition-transform duration-500 ${openIndex === index ? 'rotate-180 text-[#968B74]' : ''}`} 
                                    size={20} 
                                />
                            </button>
                            <div 
                                className={`transition-all duration-500 ease-in-out ${openIndex === index ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                            >
                                <div className="px-8 pb-8 ml-[52px] text-sm text-[#888] leading-relaxed border-t border-[#333]/30 pt-4">
                                    {faq.answer}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-20 text-center animate-fadeUp" style={{ animationDelay: '0.4s' }}>
                    <p className="text-[10px] text-[#555] uppercase tracking-[0.2em] mb-6">
                        {isBg ? 'Имате още въпроси?' : 'Have more questions?'}
                    </p>
                    <a 
                        href="mailto:support@factcheckerai.info"
                        className="inline-flex items-center gap-3 px-8 py-4 bg-transparent border border-[#968B74]/30 text-[#C4B091] text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-[#968B74]/10 transition-all rounded-sm"
                    >
                        <HelpCircle size={14} />
                        {isBg ? 'СВЪРЖЕТЕ СЕ С НАС' : 'CONTACT SUPPORT'}
                    </a>
                </div>
            </div>
        </div>
    );
};

export default FAQPage;
