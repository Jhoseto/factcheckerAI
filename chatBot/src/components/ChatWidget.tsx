import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageCircle, X, Send, Bot, User, Loader2, Clock, Paperclip, Globe, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE = '/api/chat';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [userName, setUserName] = useState(() => localStorage.getItem('chat_user_name') || '');
  const [tempName, setTempName] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [sessionId] = useState(() => {
    const saved = localStorage.getItem('chat_session_id');
    if (saved) return saved;
    const id = Math.random().toString(36).substring(7);
    localStorage.setItem('chat_session_id', id);
    return id;
  });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isResolved, setIsResolved] = useState(false);
  const [lang, setLang] = useState<'en' | 'bg'>('en');
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = {
    en: {
      welcome: "FactChecker AI Support",
      start: "Please enter your name to start the conversation.",
      placeholder: "Your Name",
      btnStart: "Start Chatting",
      online: "Online & Ready to help",
      thinking: "AI is thinking...",
      typing: "Support is typing...",
      ended: "This conversation has ended.",
      newSession: "Start New Session",
      ratingTitle: "How was your experience?",
      submitRating: "Submit Feedback",
      feedbackPlaceholder: "Any feedback? (optional)",
      inputPlaceholder: "Type your message...",
      quickReplies: ["How does video analysis work?", "Tell me about pricing and points", "I need support", "What types of analysis do you offer?"]
    },
    bg: {
      welcome: "Поддръжка FactChecker AI",
      start: "Моля, въведете името си, за да започнете.",
      placeholder: "Вашето име",
      btnStart: "Започни чат",
      online: "На линия и готов за помощ",
      thinking: "AI мисли...",
      typing: "Операторът пише...",
      ended: "Този разговор приключи.",
      newSession: "Започни нова сесия",
      ratingTitle: "Как беше Вашето преживяване?",
      submitRating: "Изпрати обратна връзка",
      feedbackPlaceholder: "Коментар? (опционално)",
      inputPlaceholder: "Напишете съобщение...",
      quickReplies: ["Как работи анализът на видео?", "Цени и точки", "Имам нужда от поддръжка", "Какви видове анализ предлагате?"]
    }
  }[lang];

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.emit('join_session', sessionId);

    // Check if resolved
    fetch(`${API_BASE}/sessions?status=resolved`)
      .then(res => res.json())
      .then(data => {
        const current = data.find((s: any) => s.id === sessionId);
        if (current) {
          setIsResolved(true);
          if (current.rating === null) setShowRating(true);
        }
      });

    // Load history
    fetch(`${API_BASE}/messages/${sessionId}`)
      .then(res => res.json())
      .then(data => setMessages(data));

    newSocket.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg]);
      if (msg.sender === 'ai' || msg.sender === 'admin') {
        setIsTyping(false);
        setAdminTyping(false);
      }
    });

    newSocket.on('user_typing', (data) => {
      if (data.sender === 'admin' || data.sender === 'ai') {
        setAdminTyping(data.isTyping);
      }
    });

    return () => {
      newSocket.close();
    };
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text?: string, file?: { url: string, type: string }) => {
    const finalMessage = text || message;
    if (!finalMessage.trim() && !file && !socket) return;

    socket?.emit('send_message', {
      sessionId,
      sender: 'customer',
      content: finalMessage,
      userName: userName || 'Visitor',
      fileUrl: file?.url,
      fileType: file?.type
    });

    if (!text && !file) setMessage('');
    if (!file) setIsTyping(true);
    
    // Stop typing indicator
    socket?.emit('typing', { sessionId, sender: 'customer', isTyping: false });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      handleSend('', { url: data.url, type: data.type });
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    if (!socket) return;

    socket.emit('typing', { sessionId, sender: 'customer', isTyping: true });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { sessionId, sender: 'customer', isTyping: false });
    }, 2000);
  };

  const submitRating = () => {
    fetch(`${API_BASE}/sessions/${sessionId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment: ratingComment })
    }).then(() => setShowRating(false));
  };

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear your chat history?')) {
      setMessages([]);
      localStorage.removeItem('chat_session_id');
      localStorage.removeItem('chat_user_name');
      window.location.reload();
    }
  };

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      setUserName(tempName.trim());
      localStorage.setItem('chat_user_name', tempName.trim());
    }
  };


  return (
    <div className="fixed bottom-10 right-14 z-50 font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="chat-glass mb-4 w-[380px] h-[550px] rounded-3xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#2C2C2C] p-6 flex items-center justify-between border-b border-[rgba(150,139,116,0.2)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[rgba(150,139,116,0.2)] text-[var(--bronze-light)]">
                  <Bot size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-[var(--bronze-light)]">FactChecker AI</h3>
                  <p className="text-xs text-[var(--bronze-mid)] flex items-center gap-1">
                    <span className="w-2 h-2 bg-[#968B74] rounded-full animate-pulse" />
                    {t.online}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setLang(lang === 'en' ? 'bg' : 'en')}
                  className="p-2 hover:bg-[rgba(150,139,116,0.15)] rounded-full transition-colors text-[var(--bronze-light)]"
                  title="Switch Language"
                >
                  <Globe size={16} />
                </button>
                <button 
                  onClick={clearHistory}
                  title="Clear history"
                  className="p-2 hover:bg-[rgba(150,139,116,0.15)] rounded-full transition-colors text-[var(--bronze-light)]"
                >
                  <Clock size={16} />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-[rgba(150,139,116,0.15)] rounded-full transition-colors text-[var(--bronze-light)]"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#222]/50"
            >
              {!userName ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-[rgba(150,139,116,0.15)]">
                    <User className="text-[var(--bronze-mid)]" size={40} />
                  </div>
                  <h4 className="text-lg font-bold text-[var(--bronze-light)] mb-2">{t.welcome}</h4>
                  <p className="text-[var(--bronze-mid)] text-sm mb-8">{t.start}</p>
                  <form onSubmit={handleStartChat} className="w-full space-y-4">
                    <input
                      autoFocus
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      placeholder={t.placeholder}
                      className="w-full bg-[#2a2a2a] border border-[rgba(150,139,116,0.2)] rounded-2xl px-4 py-3 text-sm text-[var(--bronze-light)] placeholder-[var(--bronze-dark)] focus:ring-2 focus:ring-[rgba(150,139,116,0.3)] outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!tempName.trim()}
                      className="w-full bg-[linear-gradient(to_bottom,#A89F91_0%,#786C55_100%)] text-[#1a1a1a] font-bold py-3 rounded-2xl hover:brightness-110 transition-all disabled:opacity-50 shadow-lg border border-[#C4B091]"
                    >
                      {t.btnStart}
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  {messages.length === 0 && (
                    <div className="text-center py-10">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-[rgba(150,139,116,0.15)]">
                        <Bot className="text-[var(--bronze-mid)]" size={32} />
                      </div>
                      <p className="text-[var(--bronze-mid)] text-sm">Hello {userName}! How can we help you today?</p>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <motion.div
                      initial={{ opacity: 0, x: msg.sender === 'customer' ? 10 : -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={i}
                      className={cn(
                        "flex flex-col max-w-[80%]",
                        msg.sender === 'customer' ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className={cn(
                        "px-4 py-3 text-sm",
                        msg.sender === 'customer' ? "chat-bubble-admin" : 
                        msg.sender === 'ai' ? "chat-bubble-ai" : "chat-bubble-customer"
                      )}>
                        {msg.fileUrl && (
                          <div className="mb-2">
                            {msg.fileType?.startsWith('image/') ? (
                              <img src={msg.fileUrl} alt="Upload" className="max-w-full rounded-lg shadow-sm" referrerPolicy="no-referrer" />
                            ) : (
                              <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-white/5 rounded-lg text-xs hover:bg-white/10 transition-colors text-[var(--bronze-light)]">
                                <Paperclip size={14} />
                                View Attachment
                              </a>
                            )}
                          </div>
                        )}
                        {msg.content && (
                          <div className="prose prose-sm prose-invert max-w-none [&_*]:text-[var(--bronze-light)] [&_a]:text-[var(--bronze-light)] [&_a]:underline">
                            <Markdown>{msg.content}</Markdown>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-[10px] text-[var(--bronze-mid)]">
                          {msg.sender === 'ai' ? 'AI Assistant' : msg.sender === 'admin' ? 'Support' : userName}
                        </span>
                        {msg.timestamp && (
                          <>
                            <span className="text-[10px] text-[var(--bronze-dark)]">•</span>
                            <span className="text-[10px] text-[var(--bronze-mid)]">
                              {format(new Date(msg.timestamp), 'HH:mm')}
                            </span>
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {adminTyping && (
                    <div className="flex items-center gap-2 text-[var(--bronze-mid)] text-xs italic">
                      <Loader2 size={12} className="animate-spin" />
                      {t.typing}
                    </div>
                  )}
                  {isTyping && (
                    <div className="flex items-center gap-2 text-[var(--bronze-mid)] text-xs italic">
                      <Loader2 size={12} className="animate-spin" />
                      {t.thinking}
                    </div>
                  )}
                  
                  {showRating && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#2a2a2a] p-4 rounded-2xl border border-[rgba(150,139,116,0.2)] shadow-sm space-y-3"
                    >
                      <p className="text-sm font-bold text-[var(--bronze-light)]">{t.ratingTitle}</p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(num => (
                          <button
                            key={num}
                            onClick={() => setRating(num)}
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all",
                              rating === num ? "bg-[linear-gradient(to_bottom,#A89F91_0%,#786C55_100%)] text-[#1a1a1a] border border-[#C4B091]" : "bg-[#333] text-[var(--bronze-mid)] hover:bg-[#3a3a3a] border border-[rgba(150,139,116,0.2)]"
                            )}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder={t.feedbackPlaceholder}
                        className="w-full bg-[#222] border border-[rgba(150,139,116,0.2)] rounded-xl p-2 text-xs text-[var(--bronze-light)] placeholder-[var(--bronze-dark)] outline-none focus:ring-2 focus:ring-[rgba(150,139,116,0.3)]"
                      />
                      <button
                        onClick={submitRating}
                        disabled={rating === 0}
                        className="w-full bg-[linear-gradient(to_bottom,#A89F91_0%,#786C55_100%)] text-[#1a1a1a] text-xs font-bold py-2 rounded-xl disabled:opacity-50 border border-[#C4B091]"
                      >
                        {t.submitRating}
                      </button>
                    </motion.div>
                  )}
                  
                  {messages.length > 0 && !isTyping && !isResolved && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {t.quickReplies.map((reply, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(reply)}
                          className="text-[11px] bg-[#2a2a2a] border border-[rgba(150,139,116,0.2)] text-[var(--bronze-light)] px-3 py-1.5 rounded-full hover:border-[var(--bronze-mid)] hover:bg-[#333] transition-all"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input */}
            {userName && !isResolved && (
              <div className="p-4 bg-[#2C2C2C] border-t border-[rgba(150,139,116,0.2)]">
                <div className="flex items-center gap-2 bg-[#222] rounded-2xl p-2 pl-4 border border-[rgba(150,139,116,0.15)]">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-[var(--bronze-mid)] hover:text-[var(--bronze-light)] transition-colors"
                  >
                    <Paperclip size={18} />
                  </button>
                  <input
                    type="text"
                    value={message}
                    onChange={handleTyping}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={t.inputPlaceholder}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 text-[var(--bronze-light)] placeholder-[var(--bronze-dark)]"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!message.trim()}
                    className="bg-[linear-gradient(to_bottom,#A89F91_0%,#786C55_100%)] text-[#1a1a1a] p-2 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 border border-[#C4B091]"
                  >
                    <Send size={18} />
                  </button>
                </div>
                <p className="text-[10px] text-center text-[var(--bronze-mid)] mt-3">
                  Powered by FactChecker AI & Gemini
                </p>
              </div>
            )}
            {isResolved && !showRating && (
              <div className="p-6 text-center bg-[#2C2C2C] border-t border-[rgba(150,139,116,0.2)]">
                <p className="text-sm text-[var(--bronze-mid)] italic">{t.ended}</p>
                <button 
                  onClick={clearHistory}
                  className="mt-2 text-xs text-[var(--bronze-light)] font-bold hover:underline"
                >
                  {t.newSession}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-[#1a1a1a] transition-all border-2 border-[#C4B091] hover:brightness-110"
        style={{ background: 'linear-gradient(to bottom, #A89F91 0%, #786C55 100%)' }}
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
      </motion.button>
    </div>
  );
}
