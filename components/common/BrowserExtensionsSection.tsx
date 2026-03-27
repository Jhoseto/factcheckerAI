import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ShieldCheck, Zap, Globe, MousePointerClick } from 'lucide-react';

const BrowserExtensionsSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isBg = i18n.language === 'bg';
  const [hoveredExtension, setHoveredExtension] = useState<'chrome' | 'firefox' | null>(null);
  const [installOpen, setInstallOpen] = useState(false);

  const extensions = [
    {
      id: 'chrome',
      name: isBg ? 'Chrome Extension' : 'Chrome Extension',
      description: isBg 
        ? 'Анализирайте YouTube видеа директно с един клик.'
        : 'Analyze YouTube videos directly with a single click.',
      logo: '/assets/logos/chrome-logo.png',
      color: 'from-blue-600/20 to-blue-400/10',
      borderColor: 'group-hover:border-blue-500/30',
      downloadUrl: '/factchecker-ai-extension.zip',
      features: [
        { icon: <Zap size={14} />, text: isBg ? 'Бърз анализ' : 'Quick Analysis' },
        { icon: <ShieldCheck size={14} />, text: isBg ? 'Проверка на факти' : 'Fact Checking' },
      ]
    },
    {
      id: 'firefox',
      name: isBg ? 'Firefox Extension' : 'Firefox Extension',
      description: isBg
        ? 'Пълна функционалност за вашия Firefox браузър.'
        : 'Full functionality for your Firefox browser.',
      logo: '/assets/logos/firefox-logo.png',
      color: 'from-orange-600/20 to-orange-400/10',
      borderColor: 'group-hover:border-orange-500/30',
      downloadUrl: '/factchecker-ai-extension.zip',
      features: [
        { icon: <Globe size={14} />, text: isBg ? 'Глобален обхват' : 'Global Reach' },
        { icon: <MousePointerClick size={14} />, text: isBg ? 'Лесна употреба' : 'Easy to Use' },
      ]
    }
  ];

  return (
    <section className="relative py-16 z-10">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#968B74]/20 to-transparent"></div>

      <div className="max-w-5xl mx-auto px-6 text-center animate-fadeUp">
        {/* Header */}
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-center gap-4 opacity-50">
            <div className="h-[1px] w-12 bg-[#968B74]"></div>
            <span className="text-[10px] font-bold text-[#C4B091] uppercase tracking-[0.4em]">
              {isBg ? 'РАЗШИРЕНИЯ' : 'EXTENSIONS'}
            </span>
            <div className="h-[1px] w-12 bg-[#968B74]"></div>
          </div>
          <h2 className="text-3xl md:text-4xl font-serif text-[#E0E0E0]">
            {isBg ? 'Инсталирайте в' : 'Install on'} <span className="text-bronze-gradient">{isBg ? 'Браузъра' : 'Browser'}</span>
          </h2>
        </div>

        {/* Extensions Grid - More Compact */}
        <div className="flex flex-wrap justify-center gap-5 mb-8">
          {extensions.map((ext) => {
            const isHovered = hoveredExtension === ext.id;

            return (
              <div
                key={ext.id}
                onMouseEnter={() => setHoveredExtension(ext.id as any)}
                onMouseLeave={() => setHoveredExtension(null)}
                className="group relative w-full max-w-[340px]"
              >
                {/* Card */}
                <div className={`editorial-card p-6 bg-[#1a1a1a]/80 backdrop-blur-md border border-[#333] ${ext.borderColor} transition-all duration-500 h-full flex flex-col items-center text-center ${
                  isHovered ? 'shadow-[0_15px_40px_rgba(0,0,0,0.4)] -translate-y-1' : ''
                }`}>
                  
                  {/* Real Logo */}
                  <div className="mb-5 relative">
                    <div className={`absolute inset-0 bg-gradient-to-br ${ext.color} blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                    <img 
                      src={ext.logo} 
                      alt={ext.name} 
                      className={`w-16 h-16 relative z-10 transition-transform duration-500 ${isHovered ? 'scale-110' : ''}`} 
                    />
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-serif text-[#E0E0E0] mb-2 group-hover:text-[#C4B091] transition-colors">
                    {ext.name}
                  </h3>
                  <p className="text-xs text-[#888] mb-6 leading-relaxed">
                    {ext.description}
                  </p>

                  {/* Features List - Stylish Outline Icons */}
                  <div className="flex justify-center gap-4 mb-8">
                    {ext.features.map((feature, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 text-[10px] text-[#aaa] uppercase tracking-wider bg-[#252525] px-3 py-1.5 rounded-full border border-[#333]"
                      >
                        <span className="text-[#968B74]">{feature.icon}</span>
                        {feature.text}
                      </div>
                    ))}
                  </div>

                  {/* Download Button - Compact */}
                  <button
                    onClick={() => window.open(ext.downloadUrl, '_blank')}
                    className={`w-full py-3 px-6 rounded-lg font-bold uppercase tracking-widest text-[9px] transition-all duration-300 flex items-center justify-center gap-2 ${
                      isHovered
                        ? 'bg-[#968B74] text-white shadow-lg'
                        : 'bg-[#252525] border border-[#333] text-[#888] hover:text-[#C4B091]'
                    }`}
                  >
                    <Download size={12} />
                    {isBg ? 'ИЗТЕГЛИ' : 'DOWNLOAD'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Installation Steps - Collapsible */}
        <div className="max-w-4xl mx-auto bg-[#1a1a1a]/40 border border-[#333] rounded-xl">
          <button
            type="button"
            onClick={() => setInstallOpen((prev) => !prev)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#1f1f1f]/50 transition-colors rounded-xl"
            aria-expanded={installOpen}
          >
            <div>
              <h3 className="text-base font-serif text-[#E0E0E0]">
                {isBg ? 'Как да инсталирам в Developer Mode?' : 'How to Install in Developer Mode?'}
              </h3>
              <p className="text-[11px] text-[#888] mt-1">
                {isBg
                  ? 'Натисни, за да покажеш стъпките'
                  : 'Click to show installation steps'}
              </p>
            </div>
            <span className={`text-[#C4B091] text-lg transition-transform duration-300 ${installOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {installOpen && (
            <div className="px-5 pb-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5 border-t border-[#2d2d2d] pt-5">
                {[
                  {
                    step: 1,
                    title: isBg ? 'Изтегли' : 'Download',
                    description: isBg ? 'Свалете и разархивирайте ZIP файла' : 'Download and extract the ZIP file',
                  },
                  {
                    step: 2,
                    title: isBg ? 'Отвори' : 'Open',
                    description: isBg ? 'Отидете на chrome://extensions/' : 'Go to chrome://extensions/',
                  },
                  {
                    step: 3,
                    title: isBg ? 'Активирай' : 'Enable',
                    description: isBg ? 'Включете "Developer mode" горе вдясно' : 'Enable "Developer mode" in top right',
                  },
                  {
                    step: 4,
                    title: isBg ? 'Зареди' : 'Load',
                    description: isBg ? 'Кликнете "Load unpacked" и изберете папката' : 'Click "Load unpacked" and select folder',
                  },
                ].map((item) => (
                  <div key={item.step} className="flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-full border border-[#968B74]/40 flex items-center justify-center mb-2">
                      <span className="text-[#968B74] font-bold text-xs">{item.step}</span>
                    </div>
                    <h4 className="text-sm font-serif text-[#E0E0E0] mb-1">{item.title}</h4>
                    <p className="text-[11px] text-[#666]">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default BrowserExtensionsSection;
