const DAILY_LIMIT = 20;
const MAX_PROMPT = 6000;
const TIMEOUT_MS = 15000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const SITE = 'https://hive-arc.vercel.app';
const counts = new Map();

const SYSTEM = {
  questions: 'You are the assistant inside Hive, a personal idea app. Read the user\'s idea. Ask exactly three short, creative clarifying questions, numbered 1 to 3. Each question must refer to a specific detail from the idea. Ask one question per line. Keep the whole reply under 120 words.',
  summary: 'You are the assistant inside Hive, a personal idea app. Summarise the user\'s idea in three to five plain sentences. Name the goal, the main steps the user mentioned, and any blocker. Do not invent facts that are not in the text. Keep the reply under 120 words.',
  plan: 'You are the assistant inside Hive, a personal idea app. Suggest up to six practical steps for the idea. Each step is one short line that starts with a verb. Add a time only if the text gives one. Do not invent facts. Keep the reply under 150 words.'
};

function overLimit(ip) {
  const key = ip + '|' + new Date().toISOString().slice(0, 10);
  if (counts.size > 5000) counts.clear();
  const used = counts.get(key) || 0;
  if (used >= DAILY_LIMIT) return true;
  counts.set(key, used + 1);
  return false;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  const allowed = origin === SITE || origin.startsWith('http://localhost');

  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST.', fallback: true });
  }
  if (origin && !allowed) {
    return res.status(403).json({ error: 'This site may not use the assistant.', fallback: true });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const prompt = String(body.prompt || '').slice(0, MAX_PROMPT).trim();
  const task = Object.prototype.hasOwnProperty.call(SYSTEM, body.task) ? body.task : 'questions';
  if (!prompt) {
    return res.status(400).json({ error: 'There is nothing to read yet.', fallback: true });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(503).json({ error: 'The assistant is not set up yet.', fallback: true });
  }

  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'unknown')
    .split(',')[0].trim();
  if (overLimit(ip)) {
    return res.status(429).json({
      error: 'Daily limit reached. Hive will use its built-in helper for now.',
      fallback: true
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM[task] }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 500 }
      }),
      signal: controller.signal
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return res.status(502).json({
        error: `Gemini said ${r.status}. ${detail.slice(0, 200)}`,
        fallback: true
      });
    }

    const data = await r.json();
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts) || [];
    const text = parts.map(p => p.text || '').join('').trim();

    if (!text) {
      return res.status(502).json({ error: 'No reply came back.', fallback: true });
    }
    return res.status(200).json({ text, task });
  } catch (e) {
    return res.status(502).json({
      error: 'The assistant did not answer in time. Hive will use its built-in helper.',
      fallback: true
    });
  } finally {
    clearTimeout(timer);
  }
};