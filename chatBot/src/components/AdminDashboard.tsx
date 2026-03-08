import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { io, Socket } from 'socket.io-client';
import { Users, MessageSquare, Send, Search, Bell, Menu, MoreVertical, CheckCircle2, Clock, X, Paperclip, Zap, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useNotifications } from '../../../contexts/NotificationContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE = '/api/chat';

export default function AdminDashboard() {
  const { i18n } = useTranslation();
  const { notifications, removeNotification } = useNotifications();
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [showCanned, setShowCanned] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'resolved'>('active');
  const [customerTyping, setCustomerTyping] = useState<Record<string, boolean>>({});
  const [cannedResponses, setCannedResponses] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [newCanned, setNewCanned] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = {
    en: {
      dashboard: "Admin Dashboard",
      manage: "Manage your customer conversations",
      active: "Active",
      history: "History",
      search: "Search conversations...",
      resolve: "Resolve",
      canned: "Canned Responses",
      analytics: "Analytics",
      total: "Total",
      rating: "Rating",
      typing: "Customer is typing...",
      select: "Select a conversation",
      selectDesc: "Choose a chat from the sidebar to start helping your customers in real-time.",
      add: "Add",
      newTemplate: "New template..."
    },
    bg: {
      dashboard: "Админ Табло",
      manage: "Управлявайте разговорите с клиенти",
      active: "Активни",
      history: "История",
      search: "Търсене на разговори...",
      resolve: "Приключи",
      canned: "Готови отговори",
      analytics: "Анализи",
      total: "Общо",
      rating: "Оценка",
      typing: "Клиентът пише...",
      select: "Изберете разговор",
      selectDesc: "Изберете чат от страничната лента, за да започнете да помагате на клиентите си в реално време.",
      add: "Добави",
      newTemplate: "Нов шаблон..."
    }
  }[i18n.language === 'en' ? 'en' : 'bg'];

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    const loadData = () => {
      const url = new URL(`${API_BASE}/sessions`, window.location.origin);
      url.searchParams.set('status', status);
      if (search) url.searchParams.set('search', search);

      fetch(url.toString())
        .then(res => res.json())
        .then(data => setSessions(data));

      fetch(`${API_BASE}/canned-responses`)
        .then(res => res.json())
        .then(data => setCannedResponses(data));

      fetch(`${API_BASE}/analytics`)
        .then(res => res.json())
        .then(data => setAnalytics(data));
    };

    loadData();

    newSocket.on('user_typing', (data) => {
      if (data.sender === 'customer') {
        setCustomerTyping(prev => ({ ...prev, [data.sessionId]: data.isTyping }));
      }
    });

    newSocket.on('admin_update', (data) => {
      loadData();
      if (activeSession && data.sessionId === activeSession.id) {
        fetchMessages(activeSession.id);
      }
    });

    newSocket.on('new_message', (msg) => {
      if (activeSession && msg.sessionId === activeSession.id) {
        setMessages(prev => [...prev, msg]);
      }
    });

    return () => {
      newSocket.close();
    };
  }, [activeSession, status, search]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = (sessionId: string) => {
    fetch(`${API_BASE}/messages/${sessionId}`)
      .then(res => res.json())
      .then(data => setMessages(data));
  };

  const handleSessionSelect = (session: any) => {
    setActiveSession(session);
    fetchMessages(session.id);
    socket?.emit('join_session', session.id);

    // Mark as read
    if (session.is_read === 0) {
      fetch(`${API_BASE}/sessions/${session.id}/read`, { method: 'POST' })
        .then(() => {
          setSessions(prev => prev.map(s => s.id === session.id ? { ...s, is_read: 1 } : s));
        });
    }
  };

  const handleSend = (text?: string, file?: { url: string, type: string }) => {
    const finalReply = text || reply;
    if (!finalReply.trim() && !file && !activeSession && !socket) return;

    socket?.emit('send_message', {
      sessionId: activeSession.id,
      sender: 'admin',
      content: finalReply,
      fileUrl: file?.url,
      fileType: file?.type
    });

    if (!text && !file) setReply('');
    setShowCanned(false);

    // Stop typing indicator
    socket?.emit('typing', { sessionId: activeSession.id, sender: 'admin', isTyping: false });
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

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReply(e.target.value);
    if (!socket || !activeSession) return;

    socket.emit('typing', { sessionId: activeSession.id, sender: 'admin', isTyping: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { sessionId: activeSession.id, sender: 'admin', isTyping: false });
    }, 2000);
  };

  const addCanned = () => {
    if (!newCanned.trim()) return;
    fetch(`${API_BASE}/canned-responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newCanned })
    })
      .then(res => res.json())
      .then(data => {
        setCannedResponses(prev => [...prev, data]);
        setNewCanned('');
      });
  };

  const deleteCanned = (id: number) => {
    fetch(`${API_BASE}/canned-responses/${id}`, { method: 'DELETE' })
      .then(() => setCannedResponses(prev => prev.filter(r => r.id !== id)));
  };

  const handleResolve = () => {
    if (!activeSession) return;
    if (confirm('Mark this conversation as resolved?')) {
      fetch(`${API_BASE}/sessions/${activeSession.id}/resolve`, { method: 'POST' })
        .then(() => {
          setActiveSession(null);
          setMessages([]);
          // Refresh sessions list
          const url = new URL(`${API_BASE}/sessions`, window.location.origin);
          url.searchParams.set('status', status);
          if (search) url.searchParams.set('search', search);
          fetch(url.toString())
            .then(res => res.json())
            .then(data => setSessions(data));
        });
    }
  };

  return (
    <div className="flex h-screen bg-[#222] font-sans overflow-hidden">
      {/* Notifications Toast */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className="bg-[#2C2C2C] border border-[rgba(150,139,116,0.2)] shadow-2xl rounded-2xl p-4 w-72 pointer-events-auto flex items-center gap-4 cursor-pointer hover:bg-[#333] transition-colors"
              onClick={() => {
                const session = sessions.find(s => s.id === n.sessionId);
                if (session) handleSessionSelect(session);
                removeNotification(n.id);
              }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[linear-gradient(to_bottom,#A89F91_0%,#786C55_100%)] text-[#1a1a1a]">
                <Bell size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--bronze-light)]">{n.userName}</p>
                <p className="text-xs text-[var(--bronze-mid)] truncate">{n.message}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeNotification(n.id);
                }}
                className="p-1 hover:bg-[rgba(150,139,116,0.2)] rounded-lg text-[var(--bronze-mid)]"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sidebar */}
      <div className="w-80 bg-[#2C2C2C] border-r border-[rgba(150,139,116,0.2)] flex flex-col hidden md:flex">
        <div className="p-6 border-b border-[rgba(150,139,116,0.2)] flex items-center justify-between">
          <h1 className="font-bold text-xl text-[var(--bronze-light)] flex items-center gap-2">
            <MessageSquare size={24} />
            FactChecker AI
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showAnalytics ? "bg-[rgba(150,139,116,0.2)] text-[var(--bronze-light)]" : "hover:bg-[rgba(150,139,116,0.15)] text-[var(--bronze-mid)]"
              )}
            >
              <Users size={20} />
            </button>
            <button className="p-2 hover:bg-[rgba(150,139,116,0.15)] rounded-lg text-[var(--bronze-mid)] relative">
              <Bell size={20} />
              {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full border border-[#2C2C2C]" />}
            </button>
          </div>
        </div>

        {showAnalytics && analytics && (
          <div className="p-4 bg-[#222] border-b border-[rgba(150,139,116,0.2)] grid grid-cols-2 gap-2">
            <div className="bg-[#333] p-3 rounded-xl shadow-sm border border-[rgba(150,139,116,0.2)]">
              <p className="text-[8px] font-bold text-[var(--bronze-mid)] uppercase mb-0.5">{t.total}</p>
              <p className="text-lg font-bold text-[var(--bronze-light)]">{analytics.totalChats}</p>
            </div>
            <div className="bg-[#333] p-3 rounded-xl shadow-sm border border-[rgba(150,139,116,0.2)]">
              <p className="text-[8px] font-bold text-[var(--bronze-mid)] uppercase mb-0.5">{t.rating}</p>
              <p className="text-lg font-bold text-[var(--bronze-light)]">{Number(analytics.avgRating).toFixed(1)}</p>
            </div>
          </div>
        )}

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--bronze-mid)]" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className="w-full bg-[#222] border border-[rgba(150,139,116,0.2)] rounded-xl py-2 pl-10 pr-4 text-sm text-[var(--bronze-light)] placeholder-[var(--bronze-dark)] focus:ring-2 focus:ring-[rgba(150,139,116,0.3)]"
            />
          </div>
        </div>

        <div className="px-4 mb-4">
          <div className="flex bg-[#222] p-1 rounded-xl border border-[rgba(150,139,116,0.15)]">
            <button
              onClick={() => setStatus('active')}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                status === 'active' ? "bg-[#333] text-[var(--bronze-light)] shadow-sm border border-[rgba(150,139,116,0.2)]" : "text-[var(--bronze-mid)] hover:text-[var(--bronze-light)]"
              )}
            >
              {t.active}
            </button>
            <button
              onClick={() => setStatus('resolved')}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                status === 'resolved' ? "bg-[#333] text-[var(--bronze-light)] shadow-sm border border-[rgba(150,139,116,0.2)]" : "text-[var(--bronze-mid)] hover:text-[var(--bronze-light)]"
              )}
            >
              {t.history}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 text-[10px] font-bold text-[var(--bronze-mid)] uppercase tracking-wider">
            {status === 'active' ? 'Active Chats' : 'Resolved Chats'}
          </div>
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => handleSessionSelect(session)}
              className={cn(
                "w-full p-4 flex items-center gap-3 transition-all border-l-4",
                activeSession?.id === session.id
                  ? "bg-[rgba(150,139,116,0.15)] border-[var(--bronze-mid)]"
                  : "hover:bg-[rgba(150,139,116,0.08)] border-transparent"
              )}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold shrink-0 bg-[rgba(150,139,116,0.2)] text-[var(--bronze-light)]">
                {session.user_name?.[0] || 'G'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className={cn(
                    "text-sm truncate flex items-center gap-2",
                    session.is_read === 0 ? "font-bold text-[var(--bronze-light)]" : "font-semibold text-[var(--bronze-mid)]"
                  )}>
                    {session.user_name || 'Guest'}
                    {session.is_read === 0 && (
                      <span className="w-2 h-2 bg-[var(--bronze-mid)] rounded-full shrink-0" />
                    )}
                    {session.handoff_requested === 1 && session.status === 'active' && (
                      <span className="px-1.5 py-0.5 bg-rose-900/50 text-rose-300 text-[8px] font-bold rounded uppercase">Human</span>
                    )}
                  </h3>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-[var(--bronze-mid)] shrink-0">
                      {format(new Date(session.last_active), 'HH:mm')}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[var(--bronze-mid)] truncate">
                  {customerTyping[session.id] ? (
                    <span className="text-[var(--bronze-light)] font-medium italic">{t.typing}</span>
                  ) : (
                    `ID: ${session.id}`
                  )}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeSession ? (
          <>
            {/* Chat Header */}
            <div className="h-20 bg-[#2C2C2C] border-b border-[rgba(150,139,116,0.2)] px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-[linear-gradient(to_bottom,#A89F91_0%,#786C55_100%)] text-[#1a1a1a]">
                  {activeSession.user_name?.[0] || 'G'}
                </div>
                <div>
                  <h2 className="font-bold text-[var(--bronze-light)]">{activeSession.user_name || 'Guest'}</h2>
                  <div className="flex items-center gap-2 text-xs text-[var(--bronze-mid)] font-medium">
                    <span className="w-2 h-2 bg-[var(--bronze-mid)] rounded-full" />
                    Active Now
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeSession.status === 'active' && (
                  <button
                    onClick={handleResolve}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[rgba(150,139,116,0.2)] text-[var(--bronze-light)] rounded-lg hover:bg-[rgba(150,139,116,0.3)] transition-colors text-xs font-bold"
                  >
                    <CheckCircle2 size={16} />
                    {t.resolve}
                  </button>
                )}
                <button className="p-2 hover:bg-[rgba(150,139,116,0.15)] rounded-lg text-[var(--bronze-mid)]">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#222]/50"
            >
              {activeSession.rating && (
                <div className="bg-[rgba(150,139,116,0.1)] border border-[rgba(150,139,116,0.2)] rounded-2xl p-4 flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <span key={star} className={cn("text-lg", star <= activeSession.rating ? "text-[var(--bronze-light)]" : "text-[var(--bronze-dark)]")}>★</span>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[var(--bronze-light)]">Customer Rating: {activeSession.rating}/5</p>
                      {activeSession.rating_comment && <p className="text-xs text-[var(--bronze-mid)] italic">"{activeSession.rating_comment}"</p>}
                    </div>
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col max-w-[70%]",
                    msg.sender === 'admin' ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className={cn(
                    "px-5 py-3 text-sm shadow-sm",
                    msg.sender === 'admin' ? "chat-bubble-admin" :
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
                  <div className="flex items-center gap-2 mt-1.5 px-1">
                    <span className="text-[10px] font-medium text-[var(--bronze-mid)] uppercase tracking-tighter">
                      {msg.sender === 'ai' ? 'AI Agent' : msg.sender === 'admin' ? 'You' : 'Customer'}
                    </span>
                    <span className="text-[10px] text-[var(--bronze-dark)]">•</span>
                    <span className="text-[10px] text-[var(--bronze-mid)]">
                      {format(new Date(msg.timestamp), 'HH:mm')}
                    </span>
                  </div>
                </div>
              ))}
              {customerTyping[activeSession.id] && (
                <div className="flex items-center gap-2 text-[var(--bronze-mid)] text-xs italic">
                  <Loader2 size={12} className="animate-spin" />
                  {t.typing}
                </div>
              )}
            </div>

            {/* Reply Area */}
            <div className="p-6 bg-[#2C2C2C] border-t border-[rgba(150,139,116,0.2)] relative">
              <AnimatePresence>
                {showCanned && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-6 mb-2 w-80 bg-[#2C2C2C] rounded-2xl shadow-2xl border border-[rgba(150,139,116,0.2)] overflow-hidden z-20"
                  >
                    <div className="p-3 border-b border-[rgba(150,139,116,0.2)] bg-[#222] flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--bronze-mid)] uppercase tracking-wider">{t.canned}</span>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={newCanned}
                          onChange={(e) => setNewCanned(e.target.value)}
                          placeholder={t.newTemplate}
                          className="text-[10px] border border-[rgba(150,139,116,0.2)] rounded px-1.5 py-0.5 outline-none w-20 bg-[#222] text-[var(--bronze-light)] placeholder-[var(--bronze-dark)]"
                        />
                        <button onClick={addCanned} className="text-[10px] bg-[linear-gradient(to_bottom,#A89F91_0%,#786C55_100%)] text-[#1a1a1a] px-2 py-0.5 rounded font-bold">{t.add}</button>
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {cannedResponses.map((res, i) => (
                        <div key={i} className="flex items-center group border-b border-[rgba(150,139,116,0.1)] last:border-0">
                          <button
                            onClick={() => handleSend(res.text)}
                            className="flex-1 text-left p-4 text-sm text-[var(--bronze-light)] hover:bg-[rgba(150,139,116,0.1)] transition-colors"
                          >
                            {res.text}
                          </button>
                          <button
                            onClick={() => deleteCanned(res.id)}
                            className="px-3 opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="max-w-4xl mx-auto flex items-end gap-4">
                <button
                  onClick={() => setShowCanned(!showCanned)}
                  className={cn(
                    "p-3.5 rounded-2xl transition-all shrink-0",
                    showCanned ? "bg-[rgba(150,139,116,0.2)] text-[var(--bronze-light)]" : "bg-[#222] text-[var(--bronze-mid)] hover:bg-[#333] border border-[rgba(150,139,116,0.15)]"
                  )}
                  title={t.canned}
                >
                  <Zap size={20} />
                </button>
                <div className="flex-1 bg-[#222] rounded-2xl p-2 flex items-end gap-2 focus-within:ring-2 focus-within:ring-[rgba(150,139,116,0.3)] transition-all relative border border-[rgba(150,139,116,0.15)]">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <textarea
                    value={reply}
                    onChange={handleTyping}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Write a message..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm resize-none max-h-32 min-h-[44px] py-2 text-[var(--bronze-light)] placeholder-[var(--bronze-dark)]"
                    rows={1}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-[var(--bronze-mid)] hover:text-[var(--bronze-light)] transition-colors mb-1"
                    title={t.canned}
                  >
                    <Paperclip size={18} />
                  </button>
                </div>
                <button
                  onClick={() => handleSend()}
                  disabled={!reply.trim()}
                  className="p-3.5 rounded-2xl transition-all disabled:opacity-50 border-2 border-[#C4B091] text-[#1a1a1a] hover:brightness-110"
                  style={{ background: 'linear-gradient(to bottom, #A89F91 0%, #786C55 100%)' }}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--bronze-mid)] p-12">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 bg-[rgba(150,139,116,0.15)]">
              <MessageSquare size={48} className="text-[var(--bronze-mid)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--bronze-light)] mb-2">{t.select}</h2>
            <p className="text-center max-w-xs">{t.selectDesc}</p>
          </div>
        )}
      </div>
    </div>
  );
}
