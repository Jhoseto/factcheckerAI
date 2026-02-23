/**
 * Translation API — Google Translate in real time
 * GET /api/translate?target=en — translate full locales/bg.json
 * POST /api/translate-text — translate arbitrary text (e.g. report body)
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const BATCH_SIZE = 50;
const MAX_CHAR_PER_BATCH = 28000;

function flattenLeaves(obj, prefix = '', keys = [], values = []) {
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string') {
      keys.push(prefix);
      values.push(obj);
    }
    return { keys, values };
  }
  for (const k of Object.keys(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      flattenLeaves(obj[k], key, keys, values);
    } else if (typeof obj[k] === 'string') {
      keys.push(key);
      values.push(obj[k]);
    }
  }
  return { keys, values };
}

function setByPath(obj, pathStr, value) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!(p in cur)) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

async function translateBatch(texts, target, apiKey) {
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: texts, target, format: 'text' }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Translate API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return (data.data?.translations || []).map((t) => t.translatedText || '');
}

/**
 * GET /api/translate?target=en
 * Returns translated bg.json for the target language.
 */
router.get('/translate', async (req, res) => {
  const target = (req.query.target || '').toLowerCase();
  if (!target || target === 'bg') {
    return res.status(400).json({ error: 'Missing or invalid target (e.g. target=en)' });
  }
  if (!API_KEY) {
    return res.status(503).json({ error: 'Translation service not configured (GOOGLE_TRANSLATE_API_KEY)' });
  }

  try {
    const localesPath = path.join(__dirname, '..', '..', 'locales', 'bg.json');
    const raw = await fs.readFile(localesPath, 'utf8');
    const bgJson = JSON.parse(raw);
    const { keys, values } = flattenLeaves(bgJson);

    if (values.length === 0) {
      return res.json(bgJson);
    }

    const translated = [];
    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const batch = values.slice(i, i + BATCH_SIZE);
      const batchResults = await translateBatch(batch, target, API_KEY);
      translated.push(...batchResults);
    }

    const out = {};
    keys.forEach((k, i) => setByPath(out, k, translated[i] ?? values[i]));
    res.json(out);
  } catch (err) {
    console.error('[Translate] Error:', err.message);
    res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

const MAX_CHARS_PER_REQUEST = 25000;

function chunkLongText(str) {
  if (!str || str.length <= MAX_CHARS_PER_REQUEST) return [str];
  const chunks = [];
  let rest = str;
  while (rest.length > 0) {
    if (rest.length <= MAX_CHARS_PER_REQUEST) {
      chunks.push(rest);
      break;
    }
    const slice = rest.slice(0, MAX_CHARS_PER_REQUEST);
    const lastBreak = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\n'), slice.lastIndexOf('. '));
    const splitAt = lastBreak > MAX_CHARS_PER_REQUEST / 2 ? lastBreak + 1 : MAX_CHARS_PER_REQUEST;
    chunks.push(rest.slice(0, splitAt));
    rest = rest.slice(splitAt);
  }
  return chunks.filter(Boolean);
}

/**
 * POST /api/translate-text
 * Body: { text: string, target: string }
 * Returns { translatedText: string }. Long text is chunked to stay under API limits.
 */
router.post('/translate-text', express.json({ limit: '500kb' }), async (req, res) => {
  const { text, target: rawTarget } = req.body || {};
  const target = (rawTarget || '').toLowerCase();
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid body: { text: string, target: string }' });
  }
  if (!target || target === 'bg') {
    return res.status(400).json({ error: 'Missing or invalid target (e.g. target=en)' });
  }
  if (!API_KEY) {
    return res.status(503).json({ error: 'Translation service not configured (GOOGLE_TRANSLATE_API_KEY)' });
  }

  try {
    const chunks = chunkLongText(text);
    const translatedChunks = await translateBatch(chunks, target, API_KEY);
    const translatedText = translatedChunks.join('');
    res.json({ translatedText: translatedText || text });
  } catch (err) {
    console.error('[Translate-text] Error:', err.message);
    res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

export default router;
