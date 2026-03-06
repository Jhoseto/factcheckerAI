/**
 * ChatBot SQLite database — chat.db in chatBot/ folder
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'chat.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_name TEXT,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    is_read INTEGER DEFAULT 1,
    handoff_requested INTEGER DEFAULT 0,
    rating INTEGER,
    rating_comment TEXT
  );

  CREATE TABLE IF NOT EXISTS canned_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    sender TEXT,
    content TEXT,
    file_url TEXT,
    file_type TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  );
`);

const migrations = [
  { column: 'is_read', type: 'INTEGER DEFAULT 1' },
  { column: 'handoff_requested', type: 'INTEGER DEFAULT 0' },
  { column: 'rating', type: 'INTEGER' },
  { column: 'rating_comment', type: 'TEXT' }
];

migrations.forEach(m => {
  try {
    db.prepare(`SELECT ${m.column} FROM sessions LIMIT 1`).get();
  } catch (e) {
    try {
      db.exec(`ALTER TABLE sessions ADD COLUMN ${m.column} ${m.type}`);
    } catch (err) {}
  }
});

const msgMigrations = [
  { column: 'file_url', type: 'TEXT' },
  { column: 'file_type', type: 'TEXT' }
];

msgMigrations.forEach(m => {
  try {
    db.prepare(`SELECT ${m.column} FROM messages LIMIT 1`).get();
  } catch (e) {
    try {
      db.exec(`ALTER TABLE messages ADD COLUMN ${m.column} ${m.type}`);
    } catch (err) {}
  }
});

const count = db.prepare("SELECT COUNT(*) as count FROM canned_responses").get();
if (count.count === 0) {
  const defaults = [
    "Hello! How can I help you today?",
    "Thank you for reaching out. Let me check that for you.",
    "I've resolved your issue. Is there anything else?",
    "Please wait a moment while I look into this."
  ];
  const insert = db.prepare("INSERT INTO canned_responses (text) VALUES (?)");
  defaults.forEach(t => insert.run(t));
}

export default db;
