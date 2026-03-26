import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, X, Facebook, Twitter, Linkedin, Mail } from 'lucide-react';
import { generateShareText } from '../../services/shareImageGenerator';
import type { VideoAnalysis } from '../../types';

interface ShareModalEnhancedProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  title?: string;
  analysis?: VideoAnalysis;
}

const ShareModalEnhanced: React.FC<ShareModalEnhancedProps> = ({
  isOpen,
  onClose,
  shareUrl,
  title,
  analysis,
}) => {
  const { t, i18n } = useTranslation();
  const isBg = i18n.language === 'bg';
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = 'unset';
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareText = analysis ? generateShareText(analysis, isBg) : title || 'Check this analysis';
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  const socialLinks = [
    {
      name: 'Facebook',
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: 'hover:text-blue-600',
    },
    {
      name: 'Twitter/X',
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
      color: 'hover:text-black dark:hover:text-white',
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: 'hover:text-blue-700',
    },
    {
      name: 'Email',
      icon: Mail,
      url: `mailto:?subject=${encodeURIComponent(title || 'FactChecker Analysis')}&body=${encodedText}%0A%0A${encodedUrl}`,
      color: 'hover:text-red-600',
    },
  ];

  return (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center p-4 transition-all duration-300 ${
        isOpen ? 'bg-black/50 backdrop-blur-sm' : 'bg-black/0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-gradient-to-b from-[#252525] to-[#1a1a1a] border border-[#968B74]/30 rounded-2xl shadow-2xl max-w-md w-full transition-all duration-300 transform ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#333]">
          <h2 className="text-xl font-serif text-[#E0E0E0]">
            {isBg ? 'Споделяне' : 'Share'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#333] rounded-lg transition-colors"
          >
            <X size={20} className="text-[#888]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Copy Link Section */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-[#888] uppercase tracking-widest">
              {isBg ? 'Копирай линка' : 'Copy Link'}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-[#E0E0E0] font-mono truncate"
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-3 rounded-lg font-bold uppercase tracking-wider text-xs transition-all ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#968B74] text-[#111] hover:bg-[#C4B091]'
                }`}
              >
                {copied ? '✓' : <Copy size={16} />}
              </button>
            </div>
          </div>

          {/* Social Sharing */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-[#888] uppercase tracking-widest">
              {isBg ? 'Споделяй в социални мрежи' : 'Share on Social'}
            </p>
            <div className="grid grid-cols-4 gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-3 bg-[#1a1a1a] border border-[#333] rounded-lg flex items-center justify-center transition-all hover:border-[#968B74]/60 ${social.color}`}
                    title={social.name}
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Share Text Preview */}
          {analysis && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#888] uppercase tracking-widest">
                {isBg ? 'Предпросмотр на текста' : 'Text Preview'}
              </p>
              <div className="p-3 bg-[#1a1a1a] border border-[#333] rounded-lg">
                <p className="text-sm text-[#aaa] line-clamp-3 leading-relaxed">
                  {shareText}
                </p>
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="text-center">
            <p className="text-[9px] text-[#555] uppercase tracking-widest">
              {isBg
                ? 'Динамично генерирано изображение при споделяне'
                : 'Dynamic image generated when shared'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModalEnhanced;
