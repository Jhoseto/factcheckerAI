/**
 * ChatBot REST API routes — sessions, messages, canned responses, analytics, upload
 */
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');

const router = express.Router();

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.use('/uploads', express.static(uploadsDir));

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({
    url: `/api/chat/uploads/${req.file.filename}`,
    type: req.file.mimetype
  });
});

router.get('/sessions', (req, res) => {
  const { status, search } = req.query;
  let query = "SELECT * FROM sessions";
  const params = [];
  const conditions = [];
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (search) {
    conditions.push("(user_name LIKE ? OR id LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY last_active DESC";
  const sessions = db.prepare(query).all(...params);
  res.json(sessions);
});

router.post('/sessions/:sessionId/resolve', (req, res) => {
  db.prepare("UPDATE sessions SET status = 'resolved' WHERE id = ?").run(req.params.sessionId);
  res.json({ success: true });
});

router.post('/sessions/:sessionId/rate', (req, res) => {
  const { rating, comment } = req.body;
  db.prepare("UPDATE sessions SET rating = ?, rating_comment = ? WHERE id = ?").run(rating, comment, req.params.sessionId);
  res.json({ success: true });
});

router.get('/canned-responses', (req, res) => {
  const responses = db.prepare("SELECT * FROM canned_responses").all();
  res.json(responses);
});

router.post('/canned-responses', (req, res) => {
  const { text } = req.body;
  const result = db.prepare("INSERT INTO canned_responses (text) VALUES (?)").run(text);
  res.json({ id: result.lastInsertRowid, text });
});

router.delete('/canned-responses/:id', (req, res) => {
  db.prepare("DELETE FROM canned_responses WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.get('/analytics', (req, res) => {
  const totalChats = db.prepare("SELECT COUNT(*) as count FROM sessions").get();
  const resolvedChats = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'resolved'").get();
  const avgRating = db.prepare("SELECT AVG(rating) as avg FROM sessions WHERE rating IS NOT NULL").get();
  const aiHandled = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE handoff_requested = 0").get();
  res.json({
    totalChats: totalChats.count,
    resolvedChats: resolvedChats.count,
    avgRating: avgRating.avg || 0,
    aiHandled: aiHandled.count
  });
});

router.get('/messages/:sessionId', (req, res) => {
  const messages = db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC").all(req.params.sessionId);
  res.json(messages);
});

router.post('/sessions/:sessionId/read', (req, res) => {
  db.prepare("UPDATE sessions SET is_read = 1 WHERE id = ?").run(req.params.sessionId);
  res.json({ success: true });
});

export default router;
