const DAILY_LIMIT = 60;
const MAX_PROMPT = 6000;
const MAX_TURN = 1500;
const MAX_TURNS = 12;
const TIMEOUT_MS = 15000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const SITE = 'https://hive-arc.vercel.app';
const counts = new Map();

const ROLE = `You are the assistant inside Hive, a personal idea app. You are a chat partner, not a form.
Talk naturally and briefly, in plain words. Use details from the user's own idea.
- If the user has not said what they want, ask one creative clarifying question at a time. Ground it in a specific detail of the idea.
- If the user asks for a summary, give three to five sentences: the goal, the main steps, and any blocker.
- If the user asks for steps, suggest up to six short steps. Each starts with a verb. Add a time only if the text gives one.
- When the user confirms or corrects something, acknowledge it and move on.
- Never invent facts that are not in the idea or the conversation. If something is missing, ask.
- Keep each reply under 120 words.`;

const PLAN_ROLE = `You turn the user's idea into a plan of steps for Hive.
Reply with JSON only: an array of up to six objects, each with "text" and "time".
- "text" is one short step that starts with a verb.
- "time" is a clock time or day only if the idea itself states one, such as "3pm" or "tomorrow". Otherwise use null.
- Order the steps so the first one can be done today.
- Never invent facts or times that are not in the idea.`;

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

  const idea = String(body.prompt || '').slice(0, MAX_PROMPT).trim();
  if (!idea) {
    return res.status(400).json({ error: 'There is nothing to read yet.', fallback: true });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(503).json({ error: 'The assistant is unavailable right now. Try again later.', fallback: true });
  }

  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'unknown')
    .split(',')[0].trim();
  if (overLimit(ip)) {
    return res.status(429).json({
      error: 'Daily limit reached. Hive will use its built-in helper for now.',
      fallback: true
    });
  }

  const planMode = body.mode === 'plan';

  const incoming = Array.isArray(body.messages) ? body.messages.slice(-MAX_TURNS) : [];
  const turns = incoming
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text.slice(0, MAX_TURN) }]
    }));
  if (turns.length === 0 || turns[0].role !== 'user') {
    turns.unshift({ role: 'user', parts: [{ text: 'Start the conversation. Ask me your first question about my idea.' }] });
  }

  const systemText = planMode
    ? `${PLAN_ROLE}\n\nThe user's idea:\n${idea}`
    : `${ROLE}\n\nThe user's idea:\n${idea}`;
  const contents = planMode
    ? [{ role: 'user', parts: [{ text: 'Plan this idea now.' }] }]
    : turns;
  const generationConfig = planMode
    ? { temperature: 0.5, maxOutputTokens: 700, responseMimeType: 'application/json' }
    : { temperature: 0.9, maxOutputTokens: 600 };

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
        systemInstruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig
      }),
      signal: controller.signal
    });

    if (!r.ok) {
      console.error('Gemini error', r.status, await r.text().catch(() => ''));
      return res.status(502).json({
        error: 'The assistant is busy right now. Try again in a moment.',
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

    if (planMode) {
      let steps = [];
      try {
        const arr = JSON.parse(text);
        steps = (Array.isArray(arr) ? arr : [])
          .filter(s => s && typeof s.text === 'string' && s.text.trim())
          .slice(0, 6)
          .map(s => ({
            text: s.text.trim().slice(0, 160),
            time: typeof s.time === 'string' && s.time.trim() ? s.time.trim().slice(0, 40) : null
          }));
      } catch (e) {
        steps = [];
      }
      if (!steps.length) {
        return res.status(502).json({
          error: 'The assistant could not build a plan this time. Try again.',
          fallback: true
        });
      }
      return res.status(200).json({ steps });
    }

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({
      error: 'The assistant did not answer in time. Hive will use its built-in helper.',
      fallback: true
    });
  } finally {
    clearTimeout(timer);
  }
};