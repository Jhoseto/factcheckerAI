import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Zap } from 'lucide-react';

const BrowserExtensionsSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isBg = i18n.language === 'bg';
  const [hoveredExtension, setHoveredExtension] = useState<'chrome' | 'firefox' | null>(null);

  const extensions = [
    {
      id: 'chrome',
      name: isBg ? 'Chrome Разширение' : 'Chrome Extension',
      description: isBg 
        ? 'Проверявайте YouTube видеа директно от браузъра си. Добавете бутон "Check with FactChecker" под всяко видео.'
        : 'Check YouTube videos directly from your browser. Add a "Check with FactChecker" button under every video.',
      logo: '/assets/logos/chrome-logo.png',
      color: 'from-blue-600 to-blue-400',
      downloadUrl: '#',
      features: [
        isBg ? '🎬 Директна проверка на YouTube видеа' : '🎬 Direct YouTube video verification',
        isBg ? '⚡ Моментален резултат' : '⚡ Instant results',
        isBg ? '🔐 Приватна и безопасна' : '🔐 Private & secure',
      ]
    },
    {
      id: 'firefox',
      name: isBg ? 'Firefox Разширение' : 'Firefox Extension',
      description: isBg
        ? 'Същата мощна функционалност за Firefox. Проверявайте линкове и видеа с един клик.'
        : 'Same powerful functionality for Firefox. Check links and videos with one click.',
      logo: '/assets/logos/firefox-logo.png',
      color: 'from-orange-600 to-orange-400',
      downloadUrl: '#',
      features: [
        isBg ? '🔗 Проверка на линкове в контекстното меню' : '🔗 Check links in context menu',
        isBg ? '⚡ Бързо и лесно' : '⚡ Fast & easy',
        isBg ? '🌍 Работи на всички сайтове' : '🌍 Works on all websites',
      ]
    }
  ];

  return (
    <section className="relative py-32 z-10">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#968B74]/20 to-transparent"></div>

      <div className="max-w-6xl mx-auto px-6 text-center animate-fadeUp">
        {/* Header */}
        <div className="mb-16 space-y-6">
          <div className="flex items-center justify-center gap-4 opacity-60">
            <div className="h-[1px] w-12 bg-[#968B74]"></div>
            <span className="text-[10px] font-bold text-[#C4B091] uppercase tracking-[0.4em]">
              {isBg ? 'БРАУЗЪРНИ РАЗШИРЕНИЯ' : 'BROWSER EXTENSIONS'}
            </span>
            <div className="h-[1px] w-12 bg-[#968B74]"></div>
          </div>
          <h2 className="text-4xl md:text-5xl font-serif text-[#E0E0E0] tracking-tight">
            {isBg ? 'Проверявайте' : 'Check'} <span className="text-bronze-gradient">{isBg ? 'навсякъде' : 'Everywhere'}</span>
          </h2>
          <p className="text-sm text-[#888] max-w-2xl mx-auto leading-relaxed uppercase tracking-widest">
            {isBg
              ? 'Инсталирайте нашето разширение и получете мощната проверка на FactChecker AI директно в браузъра си. Проверявайте видеа и статии без да напускате сайта.'
              : 'Install our extension and get FactChecker AI\'s powerful verification directly in your browser. Check videos and articles without leaving the site.'}
          </p>
        </div>

        {/* Extensions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {extensions.map((ext) => {
            const isHovered = hoveredExtension === ext.id;

            return (
              <div
                key={ext.id}
                onMouseEnter={() => setHoveredExtension(ext.id as any)}
                onMouseLeave={() => setHoveredExtension(null)}
                className="group relative"
              >
                {/* Card */}
                <div className={`editorial-card p-8 bg-gradient-to-br from-[#252525] to-[#1a1a1a] border border-[#333] hover:border-[#968B74]/40 transition-all duration-500 h-full flex flex-col ${
                  isHovered ? 'shadow-[0_20px_60px_rgba(196,176,145,0.15)] -translate-y-2' : ''
                }`}>
                  {/* Logo */}
                  <div className={`w-24 h-24 rounded-2xl bg-white flex items-center justify-center mb-6 mx-auto shadow-lg transition-transform duration-500 overflow-hidden ${
                    isHovered ? 'scale-110 rotate-6' : ''
                  }`}>
                    <img 
                      src={ext.logo} 
                      alt={ext.name}
                      className="w-20 h-20 object-contain"
                    />
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl font-serif text-[#E0E0E0] mb-3 group-hover:text-[#C4B091] transition-colors">
                    {ext.name}
                  </h3>
                  <p className="text-sm text-[#888] mb-6 leading-relaxed flex-grow">
                    {ext.description}
                  </p>

                  {/* Features List */}
                  <div className="space-y-2 mb-8">
                    {ext.features.map((feature, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 text-sm text-[#aaa] opacity-0 transform translate-y-2 transition-all duration-500"
                        style={{
                          animation: isHovered ? `slideUp 0.5s ease-out ${idx * 0.1}s forwards` : 'none',
                        }}
                      >
                        <span className="text-[#968B74] font-bold">✓</span>
                        {feature}
                      </div>
                    ))}
                  </div>

                  {/* Download Button */}
                  <button
                    onClick={() => window.open(ext.downloadUrl, '_blank')}
                    className={`w-full py-3 px-6 rounded-lg font-bold uppercase tracking-wider text-[10px] transition-all duration-500 flex items-center justify-center gap-2 ${
                      isHovered
                        ? `bg-gradient-to-r ${ext.color} text-white shadow-lg`
                        : 'bg-[#1a1a1a] border border-[#333] text-[#888] hover:text-[#C4B091]'
                    }`}
                  >
                    <Download size={14} />
                    {isBg ? 'ИЗТЕГЛИ' : 'DOWNLOAD'}
                  </button>
                </div>

                {/* Glow Effect */}
                <div
                  className={`absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 pointer-events-none ${
                    isHovered ? 'opacity-100' : ''
                  }`}
                  style={{
                    background: `radial-gradient(circle at center, rgba(196,176,145,0.1) 0%, transparent 70%)`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Installation Steps */}
        <div className="bg-[#252525] border border-[#333] rounded-2xl p-8 md:p-12 mb-12">
          <h3 className="text-2xl font-serif text-[#E0E0E0] mb-8 text-center">
            {isBg ? 'Как да инсталирам?' : 'How to Install?'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: 1,
                title: isBg ? 'Изтегли' : 'Download',
                description: isBg ? 'Кликни на бутона "Изтегли" за твоя браузър' : 'Click the "Download" button for your browser',
              },
              {
                step: 2,
                title: isBg ? 'Инсталирай' : 'Install',
                description: isBg ? 'Следвай инструкциите на браузъра за инсталация' : 'Follow your browser\'s installation instructions',
              },
              {
                step: 3,
                title: isBg ? 'Използвай' : 'Use',
                description: isBg ? 'Отворете YouTube или статия и кликнете на иконата' : 'Open YouTube or an article and click the icon',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#968B74] to-[#C4B091] flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <span className="text-[#111] font-black text-lg">{item.step}</span>
                </div>
                <h4 className="text-lg font-serif text-[#E0E0E0] mb-2">{item.title}</h4>
                <p className="text-sm text-[#888]">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-[10px] text-[#666] uppercase tracking-[0.2em] mb-4">
            {isBg ? 'Разширенията са напълно безплатни и открити' : 'Extensions are completely free and open-source'}
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-2 px-8 py-4 bg-transparent border border-[#968B74]/40 text-[#C4B091] text-[10px] font-bold uppercase tracking-[0.2em] rounded-lg hover:bg-[#968B74]/10 transition-all duration-300"
          >
            <Zap size={14} />
            {isBg ? 'ПРОЧЕТИ ДОКУМЕНТАЦИЯТА' : 'READ DOCUMENTATION'}
          </a>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
};

export default BrowserExtensionsSection;
