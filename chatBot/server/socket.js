/**
 * ChatBot Socket.io handlers — join_session, typing, send_message
 */
import db from './db.js';
import { getAIResponse } from './gemini.js';

export function setupChatBotSocket(io) {
  io.on('connection', (socket) => {
    socket.on('join_session', (sessionId) => {
      socket.join(sessionId);
    });

    socket.on('typing', (data) => {
      const { sessionId, sender, isTyping } = data;
      socket.to(sessionId).emit('user_typing', { sessionId, sender, isTyping });
    });

    socket.on('send_message', async (data) => {
      const { sessionId, sender, content, userName, fileUrl, fileType, lang, handoffRequested } = data;
      console.log(`[ChatSocket] Message from ${sender} in session ${sessionId}: ${content?.slice(0, 50)}...`);
      const userLang = lang === 'en' ? 'en' : 'bg';

      try {
        const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
        if (!session) {
          db.prepare('INSERT INTO sessions (id, user_name, is_read) VALUES (?, ?, ?)').run(sessionId, userName || 'Guest', sender === 'customer' ? 0 : 1);
        } else {
          if (sender === 'customer' && userName) {
            db.prepare('UPDATE sessions SET last_active = CURRENT_TIMESTAMP, is_read = 0, user_name = ? WHERE id = ?').run(userName, sessionId);
          } else {
            db.prepare('UPDATE sessions SET last_active = CURRENT_TIMESTAMP, is_read = ? WHERE id = ?').run(sender === 'customer' ? 0 : 1, sessionId);
          }
        }

        db.prepare('INSERT INTO messages (session_id, sender, content, file_url, file_type) VALUES (?, ?, ?, ?, ?)').run(sessionId, sender, content, fileUrl, fileType);

        io.to(sessionId).emit('new_message', {
          sessionId,
          sender,
          content,
          fileUrl,
          fileType,
          timestamp: new Date().toISOString()
        });

        io.emit('admin_update', { type: 'new_message', sessionId, sender, userName });

        if (sender === 'customer') {
          if (handoffRequested) {
            db.prepare('UPDATE sessions SET handoff_requested = 1 WHERE id = ?').run(sessionId);
            return;
          }
          db.prepare('UPDATE sessions SET handoff_requested = 0 WHERE id = ?').run(sessionId);

          const lowerContent = (content || '').toLowerCase();
          const needsHuman = lowerContent.includes('human') || lowerContent.includes('operator') || lowerContent.includes('person') || lowerContent.includes('agent');

          if (needsHuman) {
            db.prepare('UPDATE sessions SET handoff_requested = 1 WHERE id = ?').run(sessionId);
            const handoffMsg = userLang === 'bg'
              ? "Разбирам, че искате да говорите с оператор. Уведомяваме екипа си. Моля, изчакайте!"
              : "I understand you'd like to speak with a human. I'm notifying our team right now. One moment please!";
            db.prepare('INSERT INTO messages (session_id, sender, content) VALUES (?, ?, ?)').run(sessionId, 'ai', handoffMsg);
            io.to(sessionId).emit('new_message', { sessionId, sender: 'ai', content: handoffMsg, timestamp: new Date().toISOString() });
            return;
          }

          console.log(`[ChatSocket] Requesting AI response for session ${sessionId}...`);
          const history = db.prepare('SELECT sender, content FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT 10').all(sessionId);
          const formattedHistory = history.reverse().map(m => ({
            role: m.sender === 'customer' ? 'user' : 'model',
            parts: [{ text: m.content }]
          }));

          const aiText = await getAIResponse(content, formattedHistory, userLang);
          console.log(`[ChatSocket] AI responded for session ${sessionId}`);

          const sessionNow = db.prepare('SELECT handoff_requested FROM sessions WHERE id = ?').get(sessionId);
          if (sessionNow?.handoff_requested) return;

          db.prepare('INSERT INTO messages (session_id, sender, content) VALUES (?, ?, ?)').run(sessionId, 'ai', aiText);

          io.to(sessionId).emit('new_message', {
            sessionId,
            sender: 'ai',
            content: aiText,
            timestamp: new Date().toISOString()
          });

          const sessionInfo = db.prepare('SELECT user_name FROM sessions WHERE id = ?').get(sessionId);
          io.emit('admin_update', {
            type: 'new_message',
            sessionId,
            sender: 'ai',
            userName: `AI (to ${sessionInfo?.user_name || 'Guest'})`
          });
        }
      } catch (err) {
        console.error(`[ChatSocket] Error handling message:`, err);
      }
    });
  });
}
