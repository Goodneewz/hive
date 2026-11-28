(function () {
'use strict';

/* ===================== constants ===================== */
const KEY = 'hive-arcade';

const GAMES = [
  { id: 'puzzle', icon: '🧩', name: 'Picture Puzzle', skill: 'Planning moves ahead', blurb: 'Slide the tiles back.' },
  { id: 'word', icon: '🔤', name: 'Word Strategy', skill: 'Saving scarce letters', blurb: 'Pick the words that belong to this idea.' },
  { id: 'risk', icon: '♞', name: 'Risk Path', skill: 'Reading threats', blurb: 'Move without being cornered.' },
  { id: 'maze', icon: '🌀', name: 'Maze', skill: 'Seeing the whole route', blurb: 'Find the way out.' },
  { id: 'jigsaw', icon: '🧷', name: 'Jigsaw', skill: 'Matching parts to the whole', blurb: 'Drag real cut pieces into place.' },
  { id: 'rubik', icon: '🎲', name: 'Picture Rubik', skill: 'Reversing your own moves', blurb: 'Undo the scrambled picture.' },
  { id: 'memory', icon: '🗺️', name: 'Map the Picture', skill: 'Spatial memory', blurb: 'Memorise, then rebuild.' },
  { id: 'plan', icon: '📋', name: 'Map the Plan', skill: 'Ordering steps by logic', blurb: 'Put the steps in the right order.' },
  { id: 'route', icon: '🛣️', name: 'Route Planner', skill: 'Cost over shortcuts', blurb: 'Find the cheapest path across.' }
];

const DEFAULTS = {
  puzzle: { size: 3, diff: 'standard' },
  word: { diff: 'standard' },
  risk: { size: 6, walls: 6 },
  maze: { size: 9 },
  jigsaw: { pieces: 3, ref: 'full', timer: 'off' },
  rubik: { spins: 6 },
  memory: { symbols: 9, memorise: 8, peeks: 2 },
  plan: { feedback: 'check' },
  route: { grid: 7, terrain: 'standard' }
};

const OPTS = {
  puzzle: [
    { key: 'size', label: 'Grid', options: [[2, '2×2'], [3, '3×3'], [4, '4×4']] },
    { key: 'diff', label: 'Difficulty', options: [['calm', 'Calm'], ['standard', 'Standard'], ['sharp', 'Sharp']] }
  ],
  word: [
    { key: 'diff', label: 'Difficulty', options: [['relaxed', 'Relaxed'], ['standard', 'Standard'], ['sharp', 'Sharp']] }
  ],
  risk: [
    { key: 'size', label: 'Board', options: [[5, '5×5'], [6, '6×6'], [7, '7×7'], [8, '8×8']] },
    { key: 'walls', label: 'Walls', options: [[3, 'Light'], [6, 'Standard'], [10, 'Heavy'], [14, 'Dense']] }
  ],
  maze: [
    { key: 'size', label: 'Maze', options: [[7, '7×7'], [9, '9×9'], [11, '11×11']] }
  ],
  jigsaw: [
    { key: 'pieces', label: 'Pieces', options: [[3, '3×3'], [4, '4×4'], [5, '5×5'], [6, '6×6'], [8, '8×8'], ['128', '128 tiles']] },    { key: 'ref', label: 'Reference', options: [['full', 'Full picture'], ['dimmed', 'Dimmed behind'], ['hidden', 'Hidden']] },
    { key: 'timer', label: 'Timer', options: [['off', 'Off'], ['on', 'On']] }
  ],
  rubik: [
    { key: 'spins', label: 'Scramble', options: [[4, 'Light'], [6, 'Standard'], [9, 'Heavy']] }
  ],
  memory: [
    { key: 'symbols', label: 'Symbols', options: [[6, '6'], [9, '9'], [12, '12']] },
    { key: 'memorise', label: 'Memorise', options: [[6, '6 s'], [8, '8 s'], [12, '12 s']] },
    { key: 'peeks', label: 'Peeks', options: [[1, '1'], [2, '2'], [3, '3']] }
  ],
  plan: [
    { key: 'feedback', label: 'Feedback', options: [['check', 'At check'], ['live', 'Live colours']] }
  ],
  route: [
    { key: 'grid', label: 'Grid', options: [[6, '6×6'], [7, '7×7'], [8, '8×8']] },
    { key: 'terrain', label: 'Terrain', options: [['light', 'Light'], ['standard', 'Standard'], ['dense', 'Dense']] }
  ]
};

const SYMBOLS = ['🚀', '💡', '🎮', '📚', '📷', '🎯', '✈️', '🎨', '💻', '🎵', '🌙', '🏆'];
const FALLBACK_WORDS = ['FOCUS', 'STEADY', 'CLEAR', 'SIMPLE'];
const DISTRACTORS = ['PLANET', 'BANANA', 'GLACIER', 'TUNNEL', 'PEPPER', 'MARBLE', 'CACTUS', 'WIZARD', 'ANCHOR', 'BUTTON', 'CANDLE', 'DOLPHIN', 'ENGINE', 'FOREST', 'GARDEN', 'HAMMER', 'JACKET', 'KETTLE', 'LANTERN', 'MUSTARD'];
const DEFAULT_STEPS = ['Set the goal', 'Gather what you need', 'Build the steps', 'Do the first step', 'Check and review', 'Wrap up and confirm'];
const STOP = new Set(['that', 'this', 'with', 'from', 'have', 'will', 'they', 'them', 'then', 'than', 'what', 'when', 'where', 'which', 'about', 'into', 'just', 'also', 'your', 'want', 'need', 'make', 'some', 'very', 'more', 'like', 'going', 'would', 'could', 'should', 'there', 'their', 'here', 'been', 'were', 'because', 'only', 'over', 'such', 'each', 'other', 'still', 'today']);
const ICONS = [
  [/plan|schedule|calendar|date|week/, '🗓️'], [/money|budget|cost|price|sell|business|pay/, '💰'],
  [/code|app|build|software|tech|website/, '💻'], [/music|song|sound|voice|audio/, '🎵'],
  [/paint|design|draw|art|sketch|colou?r/, '🎨'], [/travel|trip|flight|journey|route|move/, '✈️'],
  [/book|study|learn|read|school|course/, '📚'], [/photo|image|picture|camera|video/, '📷'],
  [/game|play|fun/, '🎮'], [/rocket|launch|startup/, '🚀'], [/goal|target|aim|win/, '🎯'],
  [/night|sleep|dream/, '🌙'], [/team|people|friend|family|call|meet/, '🤝'], [/idea|think|brain|mind/, '💡']
];

/* ===================== state ===================== */
let ARC = loadArc();
const SEEDS = {};
let CUR = null;   // current game session
let LAST = null;  // { id, idea } of the last game started

function loadArc() {
  const blank = { best: {}, plays: 0, wins: 0, xp: 0, settings: {} };
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d === 'object') return Object.assign(blank, d);
  } catch (e) { /* ignore */ }
  return blank;
}
function saveArc() { try { localStorage.setItem(KEY, JSON.stringify(ARC)); } catch (e) { /* ignore */ } }
function cfgOf(id) { return Object.assign({}, DEFAULTS[id] || {}, (ARC.settings && ARC.settings[id]) || {}); }

/* ===================== helpers ===================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const range = n => Array.from({ length: n }, (_, i) => i);
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const overlayOpen = () => { const o = $('#arcOv'); return !!o && o.classList.contains('open'); };

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, r = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function say(msg, kind) { if (typeof window.hiveToast === 'function') window.hiveToast(msg, { kind: kind || 'info' }); }
function shake(el) {
  if (!el || !el.classList) return;
  el.classList.remove('arc-shake'); void el.offsetWidth; el.classList.add('arc-shake');
  setTimeout(() => { if (el.classList) el.classList.remove('arc-shake'); }, 420);
}
function nbrs(u, n) {
  const x = u % n, y = Math.floor(u / n), out = [];
  if (y > 0) out.push(u - n);
  if (y < n - 1) out.push(u + n);
  if (x > 0) out.push(u - 1);
  if (x < n - 1) out.push(u + 1);
  return out;
}
function distMap(wall, n, src) {
  const d = new Array(n * n).fill(Infinity);
  d[src] = 0;
  const q = [src];
  for (let qi = 0; qi < q.length; qi++) {
    const u = q[qi];
    for (const v of nbrs(u, n)) {
      if (wall[v] || d[v] < Infinity) continue;
      d[v] = d[u] + 1; q.push(v);
    }
  }
  return d;
}
function cheapest(wall, cost, n) {
  const N = n * n, dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === N - 1) break;
    done[u] = true;
    for (const v of nbrs(u, n)) {
      if (wall[v]) continue;
      const nd = dist[u] + cost[v];
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; }
    }
  }
  if (dist[N - 1] === Infinity) return null;
  const path = [];
  for (let v = N - 1; v !== -1; v = prev[v]) path.unshift(v);
  return { cost: dist[N - 1], path };
}
function rbApply(arr, op) {
  const out = arr.slice();
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (op.kind === 'row' && i === op.idx) out[i * 3 + j] = arr[i * 3 + ((j - op.dir + 3) % 3)];
      if (op.kind === 'col' && j === op.idx) out[i * 3 + j] = arr[((i - op.dir + 3) % 3) * 3 + j];
    }
  }
  return out;
}
function keyDir(e) {
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) return null;
  switch (e.key) {
    case 'ArrowUp': case 'w': case 'W': return 'up';
    case 'ArrowDown': case 's': case 'S': return 'down';
    case 'ArrowLeft': case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
  }
  return null;
}
function padHTML(withWait) {
  return '<div class="arc-pad">' +
    '<button class="arc-btn" data-mv="up" aria-label="Up">▲</button>' +
    '<div class="arc-pad-row"><button class="arc-btn" data-mv="left" aria-label="Left">◀</button>' +
    (withWait ? '<button class="arc-btn" data-mv="wait">⏸ Wait</button>' : '') +
    '<button class="arc-btn" data-mv="right" aria-label="Right">▶</button></div>' +
    '<button class="arc-btn" data-mv="down" aria-label="Down">▼</button></div>';
}
function whenText(v) {
  const d = new Date(v);
  return isNaN(d) ? '' : d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

/* ===================== ideas ===================== */
function ideasList() {
  const s = window.hiveLatest || window.hiveState;
  return s && Array.isArray(s.ideas) ? s.ideas : [];
}
function findIdea(id) {
  if (id == null) return null;
  return ideasList().find(i => String(i.id) === String(id)) || null;
}
function titleOf(idea) { return (idea && String(idea.title || '').trim()) || 'Untitled idea'; }
function photoOf(idea) {
  const a = (idea.attachments || []).find(x => x && typeof x.url === 'string' && x.url.startsWith('data:image'));
  return a ? a.url : null;
}
function keywordsOf(idea) {
  const text = [idea.title || '', idea.body || '', ...(idea.tags || []).map(String)].join(' ').toLowerCase();
  const words = text.match(/[a-z]{4,}/g) || [];
  const freq = {}, first = {};
  words.forEach((w, i) => {
    if (STOP.has(w)) return;
    freq[w] = (freq[w] || 0) + 1;
    if (first[w] === undefined) first[w] = i;
  });
  return Object.keys(freq).sort((a, b) => (freq[b] - freq[a]) || (first[a] - first[b])).slice(0, 8);
}
function iconFor(w) { const hit = ICONS.find(([re]) => re.test(w)); return hit ? hit[1] : '✨'; }
function pickTargets(idea) {
  const kws = keywordsOf(idea).map(w => w.toUpperCase()).filter(w => /^[A-Z]{4,9}$/.test(w));
  const out = [...new Set(kws)].slice(0, 4);
  for (const w of FALLBACK_WORDS) { if (out.length >= 4) break; if (!out.includes(w)) out.push(w); }
  return out;
}
function planSteps(idea) {
  const ts = (idea.tasks || []).filter(t => t && t.text && t.scheduled);
  if (ts.length >= 3) {
    return ts.slice().sort((a, b) => new Date(a.scheduled) - new Date(b.scheduled))
      .slice(0, 8).map(t => ({ text: String(t.text), when: t.scheduled }));
  }
  return DEFAULT_STEPS.map(text => ({ text, when: null }));
}

/* ===================== pictures ===================== */
const seedOf = id => SEEDS[id] || 0;

function wrapText(g, text, maxW, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const keep = lines.slice(0, maxLines);
    let last = keep[maxLines - 1];
    while (g.measureText(last + '…').width > maxW && last.length > 1) last = last.slice(0, -1);
    keep[maxLines - 1] = last + '…';
    return keep;
  }
  return lines;
}
function cloud(g, x, y, s) {
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.beginPath();
  g.arc(x, y, s * 0.5, 0, Math.PI * 2);
  g.arc(x + s * 0.5, y - s * 0.2, s * 0.6, 0, Math.PI * 2);
  g.arc(x + s, y, s * 0.5, 0, Math.PI * 2);
  g.fill();
}
function paintArt(idea, variant, w, h, photo) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const rnd = rng(hash(titleOf(idea) + '|' + String(idea.body || '').slice(0, 120)) + variant * 7919);
  const hue = Math.floor(rnd() * 360);

  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, `hsl(${hue} 70% 58%)`);
  sky.addColorStop(1, `hsl(${(hue + 50) % 360} 80% 84%)`);
  g.fillStyle = sky; g.fillRect(0, 0, w, h);

  const sx = w * (0.2 + rnd() * 0.6), sy = h * (0.22 + rnd() * 0.08), sr = Math.min(w, h) * 0.07;
  const glow = g.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 3.2);
  glow.addColorStop(0, 'rgba(255,236,160,.95)');
  glow.addColorStop(1, 'rgba(255,236,160,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(sx, sy, sr * 3.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();

  for (let i = 0; i < 4; i++) cloud(g, rnd() * w, h * (0.1 + rnd() * 0.3), w * (0.05 + rnd() * 0.05));

  g.strokeStyle = 'rgba(20,30,60,.45)'; g.lineWidth = Math.max(1.5, w / 260); g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const bx = w * (0.1 + rnd() * 0.8), by = h * (0.12 + rnd() * 0.2), bs = w * 0.025;
    g.beginPath();
    g.moveTo(bx - bs, by);
    g.quadraticCurveTo(bx - bs / 2, by - bs / 2, bx, by);
    g.quadraticCurveTo(bx + bs / 2, by - bs / 2, bx + bs, by);
    g.stroke();
  }

  [[0.6, 0], [0.73, 1], [0.86, 2]].forEach(([f, k]) => {
    g.fillStyle = `hsl(${(hue + 100 + k * 20) % 360} ${45 + k * 5}% ${46 - k * 10}%)`;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += Math.max(4, w / 80)) {
      g.lineTo(x, h * f - Math.sin(x / w * Math.PI * (2 + k) + k * 1.3 + hue * 0.01) * h * 0.05);
    }
    g.lineTo(w, h); g.closePath(); g.fill();
  });

  const kws = keywordsOf(idea);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  kws.slice(0, 4).forEach((k, i) => {
    g.font = `${Math.round(w * 0.07)}px serif`;
    g.fillText(iconFor(k), w * (0.14 + i * 0.24), h * 0.08);
  });

  if (photo) {
    const pw = w * 0.66, ph = h * 0.36, px = (w - pw) / 2, py = h * 0.2, bw = w * 0.012;
    g.save();
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = w * 0.03; g.fillStyle = '#fff';
    g.fillRect(px - bw, py - bw, pw + bw * 2, ph + bw * 2);
    g.restore();
    const fr = pw / ph, ir = photo.width / photo.height;
    let sw = photo.width, sh = photo.height;
    if (ir > fr) sw = photo.height * fr; else sh = photo.width / fr;
    g.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 2, sw, sh, px, py, pw, ph);
  }

  const bandY = h * 0.8;
  g.fillStyle = 'rgba(5,15,30,.86)'; g.fillRect(0, bandY, w, h - bandY);
  g.fillStyle = '#ffffff';
  g.font = `700 ${Math.round(w * 0.05)}px system-ui, sans-serif`;
  g.textAlign = 'left'; g.textBaseline = 'top';
  wrapText(g, titleOf(idea), w * 0.88, 2).forEach((ln, i) => g.fillText(ln, w * 0.06, bandY + h * 0.02 + i * w * 0.052));
  g.font = `600 ${Math.round(w * 0.035)}px system-ui, sans-serif`;
  g.textBaseline = 'middle';
  let cx = w * 0.06;
  const cy = h * 0.955;
  kws.slice(0, 3).forEach(k => {
    const t = '#' + k, tw = g.measureText(t).width + w * 0.035;
    if (cx + tw > w * 0.94) return;
    g.fillStyle = '#ffb800'; g.fillRect(cx, cy - w * 0.02, tw, w * 0.04);
    g.fillStyle = '#050f1e'; g.fillText(t, cx + w * 0.0175, cy);
    cx += tw + w * 0.02;
  });
  return c;
}
function withArt(idea, variant, w, h, cb) { cb(window.hvSceneArt ? window.hvSceneArt(idea, variant, w, h) : hvDiagramArt(idea, variant)); }
/* ===================== results ===================== */
function resultRecord(id, win, pct) {
  const xp = win ? Math.round(clamp(15 + pct / 5, 5, 60)) : 4;
  ARC.plays = (ARC.plays || 0) + 1;
  if (win) ARC.wins = (ARC.wins || 0) + 1;
  ARC.xp = (ARC.xp || 0) + xp;
  ARC.best = ARC.best || {};
  ARC.best[id] = Math.max(ARC.best[id] || 0, pct);
  saveArc();
  return xp;
}
function endRound(sess, win, pct, tips) {
  if (sess.done || CUR !== sess) return;
  sess.done = true;
  const p = Math.round(clamp(pct, 0, 100));
  const xp = resultRecord(sess.id, win, p);
  const g = GAMES.find(x => x.id === sess.id);
  if (sess.res) {
    sess.res.hidden = false;
    sess.res.innerHTML =
      `<div class="arc-res-ico">${win ? '🎉' : '🌱'}</div>` +
      `<h3>${win ? 'Round won' : 'Round over'}</h3>` +
      `<div class="arc-res-pct">${p}%</div>` +
      `<div class="arc-res-xp">+${xp} XP</div>` +
      `<ul class="arc-tips">${(tips || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` +
      `<div class="arc-res-btns"><button class="arc-btn primary" data-restart="1">▶ Play again</button><button class="arc-btn" data-back="1">‹ Games</button></div>`;
    sess.res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  say(win ? `${g.name}: ${p}% — +${xp} XP. Well thought through.` : `${g.name}: ${p}%. Every round teaches something.`, win ? 'done' : 'info');
  renderHub();
}

/* ===================== sessions ===================== */
function makeSession(id, idea) {
  const sess = {
    id, idea, cfg: cfgOf(id), done: false, timers: [], handlers: [],
    picture: ['puzzle', 'rubik', 'jigsaw'].includes(id),
    stats: () => [], stage: null, hud: null, res: null
  };
  sess.later = (fn, ms) => { const t = setTimeout(() => { if (CUR === sess) fn(); }, ms); sess.timers.push(t); return t; };
  sess.every = (fn, ms) => { const t = setInterval(() => { if (CUR === sess) fn(); }, ms); sess.timers.push(t); return t; };
  sess.listen = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); sess.handlers.push([el, ev, fn, opt]); };
  return sess;
}
function stopSession() {
  const s = CUR;
  if (!s) return;
  s.timers.forEach(t => { clearTimeout(t); clearInterval(t); });
  s.handlers.forEach(([el, ev, fn, opt]) => el.removeEventListener(ev, fn, opt));
  s.handlers = []; s.timers = [];
  s.done = true;
  CUR = null;
}
function refreshHud(sess) {
  if (!sess.hud) return;
  sess.hud.innerHTML = (sess.stats ? sess.stats() : []).map(([k, v]) => `<span class="arc-chip">${esc(k)} <b>${esc(v)}</b></span>`).join('');
}

/* ===================== overlay, picker, shell ===================== */
function buildOverlay() {
  if ($('#arcOv')) return;
  const ov = document.createElement('div');
  ov.id = 'arcOv';
  ov.className = 'arc-ov';
  ov.innerHTML = '<div class="arc-modal" role="dialog" aria-modal="true" aria-labelledby="arcTitle">' +
    '<div class="arc-mhead"><span id="arcIcon" class="arc-ico">🎮</span><h2 id="arcTitle">Thinking games</h2>' +
    '<button id="arcX" class="arc-x" aria-label="Close">✕</button></div><div id="arcBody"></div></div>';
  document.body.appendChild(ov);
  $('#arcX').addEventListener('click', closeArc);
  ov.addEventListener('click', e => { if (e.target === ov) closeArc(); });
  $('#arcBody').addEventListener('click', onBodyClick);
}
function closeArc() {
  stopSession();
  const ov = $('#arcOv');
  if (ov) ov.classList.remove('open');
  renderHub();
}
function preselectId() {
  const ov = $('#ideaOverlay');
  if (!ov || getComputedStyle(ov).display === 'none') return null;
  const t = ($('#eTitle') || {}).value || '';
  const hit = ideasList().find(i => (i.title || '') === t);
  return hit ? hit.id : null;
}
function emptyIdeas(body) {
  body.innerHTML = '<div class="arc-empty"><div class="arc-big">💡</div><p>No ideas yet. Make one first, then the games are built from it.</p></div>';
}
function showPicker(preId) {
  stopSession();
  LAST = null;
  $('#arcIcon').textContent = '🎮';
  $('#arcTitle').textContent = 'Choose a thinking game';
  const body = $('#arcBody');
  const ideas = ideasList();
  if (!ideas.length) { emptyIdeas(body); return; }
  const pick = ideas.some(i => String(i.id) === String(preId)) ? String(preId) : String(ideas[0].id);
  body.innerHTML =
    `<label class="arc-setg">Idea<select id="arcIdeaSel">${ideas.map(i => `<option value="${esc(i.id)}" ${String(i.id) === pick ? 'selected' : ''}>${esc(titleOf(i))}</option>`).join('')}</select></label>` +
    `<div class="arc-pick">${GAMES.map(g => `<button class="arc-g" data-game="${g.id}"><span class="arc-gi">${g.icon}</span><b>${esc(g.name)}</b><small>${esc(g.skill)}</small></button>`).join('')}</div>`;
}
function showIdeaChooser(gameId) {
  stopSession();
  LAST = null;
  const g = GAMES.find(x => x.id === gameId);
  $('#arcIcon').textContent = g.icon;
  $('#arcTitle').textContent = g.name;
  const body = $('#arcBody');
  const ideas = ideasList();
  if (!ideas.length) { emptyIdeas(body); return; }
  body.innerHTML =
    `<p class="arc-note">Which idea should ${esc(g.name)} be built from?</p>` +
    `<div class="arc-pick">${ideas.map(i => `<button class="arc-g" data-idea="${esc(i.id)}" data-game="${g.id}"><span class="arc-gi">💡</span><b>${esc(titleOf(i))}</b><small>${esc(keywordsOf(i).slice(0, 3).join(' · ') || 'No keywords yet')}</small></button>`).join('')}</div>` +
    '<div class="arc-row"><button class="arc-btn" data-back-home="1">‹ All games</button></div>';
}
function settingsHTML(id) {
  const groups = OPTS[id] || [];
  if (!groups.length) return '<span class="arc-note">No settings for this game.</span>';
  const cfg = cfgOf(id);
  return groups.map(gr =>
    `<label class="arc-setg">${esc(gr.label)}<select data-set="${gr.key}">` +
    gr.options.map(([v, l]) => `<option value="${esc(v)}" ${String(cfg[gr.key]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('') +
    '</select></label>').join('');
}
function renderShell(sess) {
  const g = GAMES.find(x => x.id === sess.id);
  $('#arcIcon').textContent = g.icon;
  $('#arcTitle').textContent = g.name;
  const body = $('#arcBody');
  body.innerHTML =
    `<div class="arc-top"><button class="arc-btn" data-back="1">‹ Games</button><span class="arc-chip">🎯 ${esc(g.skill)}</span><span class="arc-chip">💡 ${esc(titleOf(sess.idea))}</span></div>` +
    `<p class="arc-blurb">${esc(g.blurb)}</p>` +
    `<div class="arc-set">${settingsHTML(sess.id)}</div>` +
    '<div class="arc-hud"></div><div class="arc-stage"></div>' +
    `<div class="arc-foot"><button class="arc-btn" data-restart="1">↻ New round</button>${sess.picture ? '<button class="arc-btn" data-newpic="1">🎨 New picture</button>' : ''}</div>` +
    '<div class="arc-res" hidden></div>';
  sess.stage = body.querySelector('.arc-stage');
  sess.hud = body.querySelector('.arc-hud');
  sess.res = body.querySelector('.arc-res');
  body.querySelectorAll('select[data-set]').forEach(sel => {
    sel.addEventListener('change', () => {
      const grp = (OPTS[sess.id] || []).find(x => x.key === sel.dataset.set);
      const opt = grp && grp.options.find(([v]) => String(v) === sel.value);
      if (!opt) return;
      ARC.settings = ARC.settings || {};
      ARC.settings[sess.id] = Object.assign({}, ARC.settings[sess.id] || {}, { [grp.key]: opt[0] });
      saveArc();
      say('Settings saved. New round.', 'info');
      runGame(sess.id, sess.idea);
    });
  });
}
function runGame(id, idea) {
  stopSession();
  if (!idea) { showPicker(null); return; }
  buildOverlay();
  const sess = makeSession(id, idea);
  CUR = sess;
  LAST = { id, idea: idea.id };
  sess.hudRefresh = () => refreshHud(sess);
  renderShell(sess);
  GAME_FN[id](sess);
  refreshHud(sess);
}
function openArc(ideaId, gameId) {
  buildOverlay();
  $('#arcOv').classList.add('open');
  const pre = ideaId != null ? ideaId : preselectId();
  if (gameId) {
    const idea = findIdea(pre);
    if (idea) runGame(gameId, idea); else showIdeaChooser(gameId);
  } else {
    showPicker(pre);
  }
}
function onBodyClick(e) {
  const t = e.target.closest('[data-game],[data-idea],[data-back],[data-back-home],[data-restart],[data-newpic]');
  if (!t) return;
  if (t.hasAttribute('data-idea')) { runGame(t.dataset.game, findIdea(t.dataset.idea)); return; }
  if (t.hasAttribute('data-game')) {
    const sel = $('#arcIdeaSel');
    const idea = findIdea(sel ? sel.value : null);
    if (!idea) { say('Make an idea first, then pick a game.', 'info'); return; }
    runGame(t.dataset.game, idea);
    return;
  }
  if (t.hasAttribute('data-back-home')) { showPicker(null); return; }
  if (t.hasAttribute('data-back')) { showPicker(LAST ? LAST.idea : null); return; }
  if (t.hasAttribute('data-restart')) { if (LAST) runGame(LAST.id, findIdea(LAST.idea)); return; }
  if (t.hasAttribute('data-newpic')) {
    if (LAST) { SEEDS[LAST.idea] = seedOf(LAST.idea) + 1; runGame(LAST.id, findIdea(LAST.idea)); }
  }
}

/* ===================== hub ===================== */
function hubHTML() {
  const ideas = ideasList().length;
  const cards = GAMES.map(g => {
    const b = ARC.best ? ARC.best[g.id] : undefined;
    return `<button class="arc-card" data-hub-game="${g.id}"><span class="arc-cico">${g.icon}</span><b>${esc(g.name)}</b><small>${esc(g.skill)}</small><em>${b == null ? 'Not played yet' : 'Best ' + b + '%'}</em></button>`;
  }).join('');
  return '<section class="arc-hub"><div class="arc-hero"><div class="arc-eyebrow">Arcade</div><h2>Nine thinking games</h2>' +
    `<p>${ideas ? 'Built from your own ideas: planning, saving scarce letters, reading threats, seeing the route.' : 'Make an idea first. Then these games are built from it.'}</p>` +
    '<button id="arcOpen" class="arc-btn primary">🧠 Play from your ideas</button>' +
    `<div class="arc-tally">${ARC.plays || 0} played · ${ARC.wins || 0} won · ${ARC.xp || 0} XP</div></div>` +
    `<div class="arc-grid">${cards}</div></section>`;
}
function renderHub() {
  const p = $('#play');
  if (p) p.innerHTML = hubHTML();
}

/* ===================== global wiring ===================== */
function onDocClick(e) {
  const t = e.target;
  if (!(t instanceof Element)) return;
  if (t.closest('#arcOv')) return;
  const hub = t.closest('[data-hub-game]');
  if (hub) { e.preventDefault(); e.stopPropagation(); openArc(null, hub.dataset.hubGame); return; }
  if (t.closest('#arcOpen')) { e.preventDefault(); e.stopPropagation(); openArc(null, null); return; }
  if (t.closest('[data-view="play"]')) { setTimeout(renderHub, 40); return; }
  if (t.closest('#ideaBody')) return; // arcade-link.js handles the idea window
  if (t.closest('[data-play],[data-arc-open]')) { openArc(null, null); return; }
  let el = t;
  for (let i = 0; i < 5 && el; i++, el = el.parentElement) {
    if (/^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'button') {
      const txt = el.textContent || '';
      if (/turn it into a game/i.test(txt) && txt.length < 60) { openArc(null, null); return; }
    }
  }
}
function onKey(e) {
  if (e.key === 'Escape' && overlayOpen()) closeArc();
}
function injectCss() {
  if ($('#arcCss')) return;
  const s = document.createElement('style');
  s.id = 'arcCss';
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* ===================== GAME: Picture Puzzle ===================== */
function gamePuzzle(sess) {
  const n = +sess.cfg.size || 3, N = n * n;
  const base = { calm: 36, standard: 30, sharp: 22 }[sess.cfg.diff] || 30;
  const shuffleMoves = { calm: 40, standard: 90, sharp: 160 }[sess.cfg.diff] || 90;
  const par = Math.max(4, Math.round(base * N / 9));
  const st = { grid: [], url: '', moves: 0, peeked: false };
  sess.stats = () => [['Moves', st.moves], ['Par', par], ['Grid', n + '×' + n]];
  sess.stage.innerHTML = '<div class="arc-loading">🎨 Painting a picture from your idea…</div>';

  const isSolved = () => st.grid.every((v, i) => v === i);

  function render() {
    const cells = st.grid.map((v, p) => {
      if (v === N - 1) return `<button class="arc-pz-cell blank" data-pos="${p}" aria-label="Gap"></button>`;
      const col = v % n, row = Math.floor(v / n);
      const x = n > 1 ? col / (n - 1) * 100 : 0, y = n > 1 ? row / (n - 1) * 100 : 0;
      return `<button class="arc-pz-cell" data-pos="${p}" style="background-image:url('${st.url}');background-size:${n * 100}% ${n * 100}%;background-position:${x}% ${y}%"></button>`;
    }).join('');
    sess.stage.innerHTML =
      `<div class="arc-pz-wrap"><div class="arc-pz" style="grid-template-columns:repeat(${n},1fr)">${cells}</div></div>` +
      '<div class="arc-row"><button class="arc-btn" data-peek="1">👁 Peek (−10)</button></div>';
    sess.hudRefresh();
  }
  function scramble() {
    do {
      st.grid = range(N);
      let b = N - 1, last = -1;
      for (let i = 0; i < shuffleMoves; i++) {
        const br = Math.floor(b / n), bc = b % n, nb = [];
        if (br > 0) nb.push(b - n);
        if (br < n - 1) nb.push(b + n);
        if (bc > 0) nb.push(b - 1);
        if (bc < n - 1) nb.push(b + 1);
        const opts = nb.filter(p => p !== last);
        const pick = opts[Math.floor(Math.random() * opts.length)];
        [st.grid[b], st.grid[pick]] = [st.grid[pick], st.grid[b]];
        last = b; b = pick;
      }
    } while (isSolved());
  }
  function solved() {
    render();
    const pct = Math.max(5, 100 - 3 * Math.max(0, st.moves - par) - (st.peeked ? 10 : 0));
    endRound(sess, true, pct, [
      `Solved in ${st.moves} moves. Par was ${par}.`,
      st.peeked ? 'A peek costs 10 points. Try to hold the picture in your head.' : 'No peeks. You planned it in your head.',
      'Work from the edges in: finish one row at a time.'
    ]);
  }
  function slideTo(pos) {
    if (sess.done || !st.grid.length) return;
    const b = st.grid.indexOf(N - 1);
    const br = Math.floor(b / n), bc = b % n, pr = Math.floor(pos / n), pc = pos % n;
    if (Math.abs(br - pr) + Math.abs(bc - pc) !== 1) {
      say('Only the tile next to the gap can slide.', 'info');
      shake(sess.stage);
      return;
    }
    [st.grid[b], st.grid[pos]] = [st.grid[pos], st.grid[b]];
    st.moves++;
    if (isSolved()) { solved(); return; }
    render();
  }
  function peek() {
    if (!st.url) return;
    if (!st.peeked) { st.peeked = true; say('Peek used: −10 points. Use it wisely.', 'warn'); }
    const wrap = sess.stage.querySelector('.arc-pz-wrap');
    if (!wrap) return;
    wrap.querySelectorAll('.arc-peek').forEach(el => el.remove());
    wrap.insertAdjacentHTML('beforeend', `<div class="arc-peek"><img src="${st.url}" alt="Full picture"></div>`);
    sess.later(() => { wrap.querySelectorAll('.arc-peek').forEach(el => el.remove()); }, 1100);
    sess.hudRefresh();
  }

  sess.listen(sess.stage, 'click', e => {
    if (sess.done || !st.grid.length) return;
    if (e.target.closest('[data-peek]')) { peek(); return; }
    const cell = e.target.closest('[data-pos]');
    if (cell) slideTo(+cell.dataset.pos);
  });
  sess.listen(document, 'keydown', e => {
    if (sess.done || !st.grid.length || !overlayOpen()) return;
    const d = keyDir(e);
    if (!d) return;
    e.preventDefault();
    const b = st.grid.indexOf(N - 1), r = Math.floor(b / n), c = b % n;
    let src = -1;
    if (d === 'up' && r > 0) src = b - n;
    if (d === 'down' && r < n - 1) src = b + n;
    if (d === 'left' && c > 0) src = b - 1;
    if (d === 'right' && c < n - 1) src = b + 1;
    if (src >= 0) slideTo(src);
  });

  withArt(sess.idea, seedOf(sess.idea.id), 480, 480, cvs => {
    if (CUR !== sess) return;
    st.url = cvs.toDataURL('image/png');
    scramble();
    render();
  });
}

/* ===================== GAME: Word Strategy ===================== */
function gameWord(sess) {
  const diff = sess.cfg.diff;
  const extra = { relaxed: 8, standard: 4, sharp: 2 }[diff] ?? 4;
  const nDis = { relaxed: 3, standard: 6, sharp: 9 }[diff] ?? 6;
  const pen = { relaxed: 3, standard: 5, sharp: 8 }[diff] ?? 5;
  const targets = pickTargets(sess.idea);
  const pool = targets.join('').split('');
  const bank = {};
  pool.forEach(l => { bank[l] = (bank[l] || 0) + 1; });
  for (let i = 0; i < extra; i++) {
    const l = pool[Math.floor(Math.random() * pool.length)];
    bank[l] = (bank[l] || 0) + 1;
  }
  const dis = shuffle(DISTRACTORS.filter(w => !targets.includes(w))).slice(0, nDis);
  const cands = shuffle([...targets.map(w => ({ w, t: true })), ...dis.map(w => ({ w, t: false }))])
    .map(c => ({ ...c, picked: false }));
  let found = 0, wrong = 0, finished = false;

  const need = w => { const m = {}; w.split('').forEach(l => { m[l] = (m[l] || 0) + 1; }); return m; };
  const affordable = w => Object.entries(need(w)).every(([l, k]) => (bank[l] || 0) >= k);
  const lettersLeft = () => Object.values(bank).reduce((a, b) => a + b, 0);
  const score = () => clamp(Math.round(found / targets.length * 100 - wrong * pen), 0, 100);
  sess.stats = () => [['Found', `${found}/${targets.length}`], ['Wrong', wrong], ['Letters left', lettersLeft()]];

  function draw() {
    const bankHTML = Object.keys(bank).filter(l => bank[l] > 0).sort()
      .map(l => `<span class="arc-let">${l}<sub>${bank[l]}</sub></span>`).join('') || '<span class="arc-note">No letters left</span>';
    const chips = cands.map((c, i) => `<button class="arc-wd${c.picked ? (c.t ? ' ok' : ' bad') : ''}" data-wd="${i}" ${c.picked ? 'disabled' : ''}>${c.w}</button>`).join('');
    sess.stage.innerHTML =
      '<p class="arc-note">Each word you spell spends its letters from the bank. Spend them on this idea\'s words only.</p>' +
      `<div class="arc-bank">${bankHTML}</div><div class="arc-wds">${chips}</div>` +
      '<div class="arc-row"><button class="arc-btn" data-finish="1">✋ Finish now</button></div>';
    sess.hudRefresh();
  }
  function finish() {
    if (finished || sess.done) return;
    finished = true;
    const pct = score();
    endRound(sess, pct >= 60, pct, [
      `You found ${found} of ${targets.length} idea words.`,
            wrong ? `${wrong} wrong pick${wrong === 1 ? '' : 's'}. Read each word against the idea before you spend its letters.` : 'No wrong picks. Every word you spent belonged to this idea.',
      cands.some(c => c.t && !c.picked) ? `Still unfound: ${cands.filter(c => c.t && !c.picked).map(c => c.w).join(', ')}.` : 'Every idea word was found.'
    ]);
  }
  sess.listen(sess.stage, 'click', e => {
    if (CUR !== sess || sess.done || finished) return;
    if (e.target.closest('[data-finish]')) { finish(); return; }
    const btn = e.target.closest('[data-wd]');
    if (!btn) return;
    const c = cands[+btn.dataset.wd];
    if (!c || c.picked) return;
    if (!affordable(c.w)) {
      say('Those letters are used up. Pick a word you can still spell.', 'warn');
      shake(btn);
      return;
    }
    for (const ch of c.w) bank[ch]--;
    c.picked = true;
    if (c.t) {
      found++;
      say(`${c.w} belongs to this idea.`, 'ok');
    } else {
      wrong++;
      say(`${c.w} does not fit this idea.`, 'warn');
    }
    draw();
    if (found >= targets.length) finish();
  });
  draw();
}

function arrowEl(kind, idx, dir, glyph) {
  return `<button class="arc-arw" data-rb-kind="${kind}" data-rb-idx="${idx}" data-rb-dir="${dir}" aria-label="Move ${kind === 'row' ? 'row' : 'column'} ${idx + 1}">${glyph}</button>`;
}

function gameRisk(sess) {
  const n = +sess.cfg.size || 6;
  const W = +sess.cfg.walls || 6;
  const N = n * n;
  const start = 0;
  const goal = N - 1;
  const foes = W < 6 ? 1 : W < 10 ? 2 : 3;
  const spots = [n - 1, (n - 1) * n, (n - 1) * n + Math.floor(n / 2), Math.floor(n / 2) * n + n - 1];
  let wall = [];
  let me = start;
  let foeList = [];
  let moves = 0;
  let over = false;

  const nb = u => {
    const x = u % n, y = Math.floor(u / n), out = [];
    if (x > 0) out.push(u - 1);
    if (x < n - 1) out.push(u + 1);
    if (y > 0) out.push(u - n);
    if (y < n - 1) out.push(u + n);
    return out;
  };

  const dist = src => {
    const d = new Array(N).fill(-1), q = [src];
    d[src] = 0;
    for (let i = 0; i < q.length; i++) {
      const u = q[i];
      for (const v of nb(u)) {
        if (!wall[v] && d[v] < 0) { d[v] = d[u] + 1; q.push(v); }
      }
    }
    return d;
  };

  const makeWalls = () => {
    const blocked = new Set([start, goal, ...spots.slice(0, foes)]);
    for (let tries = 0; tries < 300; tries++) {
      const w = new Array(N).fill(false);
      let placed = 0;
      while (placed < W) {
        const u = Math.floor(Math.random() * N);
        if (!w[u] && !blocked.has(u)) { w[u] = true; placed++; }
      }
      wall = w;
      if (dist(start)[goal] >= 0) return;
    }
    wall = new Array(N).fill(false);
  };

  const reset = () => {
    makeWalls();
    me = start;
    foeList = spots.slice(0, foes);
    moves = 0;
    over = false;
  };

  const foeTurn = () => {
    const d = dist(me);
    foeList = foeList.map(f => {
      let best = f, bd = d[f];
      for (const v of nb(f)) {
        if (!wall[v] && d[v] >= 0 && d[v] < bd) { best = v; bd = d[v]; }
      }
      return best;
    });
  };

  const end = won => {
    if (over) return;
    over = true;
    const pct = won ? clamp(100 - 2 * moves, 0, 100) : 25;
    endRound(sess, won, pct, won
      ? [`Reached the flag in ${moves} moves.`, 'You read the enemies before each move, not after.', 'Good routes keep an exit open behind you.']
      : ['An enemy reached you.', 'Before each move, check which cells an enemy can step to next.', 'Waiting is a real move: it lets enemies come closer.']);
  };

  const act = dir => {
    if (over || sess.done || CUR !== sess) return;
    let to = me;
    if (dir !== 'wait') {
      const x = me % n, y = Math.floor(me / n);
      const X = x + ({ left: -1, right: 1 }[dir] || 0);
      const Y = y + ({ up: -1, down: 1 }[dir] || 0);
      if (X < 0 || Y < 0 || X >= n || Y >= n || wall[Y * n + X]) {
        say('A wall blocks that way.', 'info');
        shake(sess.stage);
        return;
      }
      to = Y * n + X;
    }
    moves++;
    me = to;
    if (me === goal) { draw(); end(true); return; }
    if (!foeList.includes(me)) foeTurn();
    draw();
    if (foeList.includes(me)) end(false);
  };

  const draw = () => {
    const t = new Set();
    for (const f of foeList) for (const v of nb(f)) if (!wall[v]) t.add(v);
    let cells = '';
    for (let i = 0; i < N; i++) {
      let cls = 'arc-rk-c', icon = '';
      if (wall[i]) cls += ' wall';
      else if (i === me) { cls += ' me'; icon = '🙂'; }
      else if (foeList.includes(i)) { cls += ' foe'; icon = '👾'; }
      else if (i === goal) { cls += ' goal'; icon = '🚩'; }
      else if (t.has(i)) cls += ' threat';
      cells += `<div class="${cls}">${icon}</div>`;
    }
    sess.stage.innerHTML =
      '<p class="arc-note">Reach the flag. Red cells are next for an enemy: stepping there ends the round.</p>' +
      `<div class="arc-rk" style="grid-template-columns:repeat(${n},1fr)">${cells}</div>` +
      padHTML(true);
    sess.hudRefresh();
  };

  sess.listen(document, 'keydown', e => {
    if (CUR !== sess || sess.done || over) return;
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    if (e.key === ' ' || e.key === '.') { e.preventDefault(); act('wait'); return; }
    const d = keyDir(e);
    if (d) { e.preventDefault(); act(d); }
  });
  sess.listen(sess.stage, 'click', e => {
    const b = e.target.closest('[data-mv]');
    if (b) act(b.dataset.mv);
  });
  sess.stats = () => [['Moves', moves], ['Enemies', foeList.length], ['Walls', W]];
  reset();
  draw();
}

function gameMaze(sess) {
  const n = +sess.cfg.size || 9;
  const grid = [];
  for (let y = 0; y < n; y++) {
    const row = [];
    for (let x = 0; x < n; x++) {
      row.push({ n: true, s: true, e: true, w: true, visited: false });
    }
    grid.push(row);
  }

  const stack = [[0, 0]];
  grid[0][0].visited = true;
  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];
    const neighbors = [];
    if (cy > 0 && !grid[cy - 1][cx].visited) neighbors.push([cx, cy - 1, 'n', 's']);
    if (cy < n - 1 && !grid[cy + 1][cx].visited) neighbors.push([cx, cy + 1, 's', 'n']);
    if (cx > 0 && !grid[cy][cx - 1].visited) neighbors.push([cx - 1, cy, 'w', 'e']);
    if (cx < n - 1 && !grid[cy][cx + 1].visited) neighbors.push([cx + 1, cy, 'e', 'w']);
    if (neighbors.length > 0) {
      const [nx, ny, dir, opp] = neighbors[Math.floor(Math.random() * neighbors.length)];
      grid[cy][cx][dir] = false;
      grid[ny][nx][opp] = false;
      grid[ny][nx].visited = true;
      stack.push([nx, ny]);
    } else {
      stack.pop();
    }
  }

  const q = [[0, 0, 0]];
  const seen = new Set(['0,0']);
  let par = n * 2;
  while (q.length > 0) {
    const [cx, cy, d] = q.shift();
    if (cx === n - 1 && cy === n - 1) { par = d; break; }
    const c = grid[cy][cx];
    if (!c.n && !seen.has(`${cx},${cy - 1}`)) { seen.add(`${cx},${cy - 1}`); q.push([cx, cy - 1, d + 1]); }
    if (!c.s && !seen.has(`${cx},${cy + 1}`)) { seen.add(`${cx},${cy + 1}`); q.push([cx, cy + 1, d + 1]); }
    if (!c.w && !seen.has(`${cx - 1},${cy}`)) { seen.add(`${cx - 1},${cy}`); q.push([cx - 1, cy, d + 1]); }
    if (!c.e && !seen.has(`${cx + 1},${cy}`)) { seen.add(`${cx + 1},${cy}`); q.push([cx + 1, cy, d + 1]); }
  }

  let px = 0, py = 0, moves = 0, over = false;
  sess.stats = () => [['Moves', moves], ['Par', par], ['Size', `${n}×${n}`]];

  sess.stage.innerHTML =
    '<p class="arc-note">Find your way from top-left to the flag in the bottom-right corner.</p>' +
    '<div class="arc-mz-wrap"><canvas class="arc-mz-cv" width="340" height="340"></canvas></div>' +
    padHTML(false);

  const cv = sess.stage.querySelector('.arc-mz-cv');
  const ctx = cv.getContext('2d');
  const sz = 340 / n;

  function draw() {
    ctx.fillStyle = '#0b1326';
    ctx.fillRect(0, 0, 340, 340);

    ctx.font = `${Math.floor(sz * 0.7)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚩', (n - 0.5) * sz, (n - 0.5) * sz);

    ctx.fillStyle = '#ffb800';
    ctx.beginPath();
    ctx.arc((px + 0.5) * sz, (py + 0.5) * sz, sz * 0.32, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#3a4d6b';
    ctx.lineWidth = Math.max(2, Math.floor(sz * 0.08));
    ctx.lineCap = 'round';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const c = grid[y][x];
        const x0 = x * sz, y0 = y * sz, x1 = (x + 1) * sz, y1 = (y + 1) * sz;
        ctx.beginPath();
        if (c.n) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); }
        if (c.s) { ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); }
        if (c.w) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); }
        if (c.e) { ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); }
        ctx.stroke();
      }
    }
    sess.hudRefresh();
  }

  function move(dir) {
    if (over || sess.done || CUR !== sess) return;
    const c = grid[py][px];
    let moved = false;
    if (dir === 'up' && !c.n && py > 0) { py--; moved = true; }
    else if (dir === 'down' && !c.s && py < n - 1) { py++; moved = true; }
    else if (dir === 'left' && !c.w && px > 0) { px--; moved = true; }
    else if (dir === 'right' && !c.e && px < n - 1) { px++; moved = true; }
    else {
      shake(cv);
      return;
    }
    if (moved) {
      moves++;
      draw();
      if (px === n - 1 && py === n - 1) {
        over = true;
        const pct = clamp(100 - 2 * Math.max(0, moves - par), 10, 100);
        endRound(sess, true, pct, [
          `Exit reached in ${moves} moves. Par was ${par}.`,
          moves <= par ? 'Optimal path found with zero wasted steps.' : `${moves - par} extra moves taken. Look ahead before turning.`,
          'Maze navigation trains lookahead discipline and path tracking.'
        ]);
      }
    }
  }

  sess.listen(document, 'keydown', e => {
    if (CUR !== sess || sess.done || over) return;
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    const d = keyDir(e);
    if (d) { e.preventDefault(); move(d); }
  });
  sess.listen(sess.stage, 'click', e => {
    const b = e.target.closest('[data-mv]');
    if (b) move(b.dataset.mv);
  });

  draw();
}
function gameMaze(sess) {
  const n = +sess.cfg.size || 9;
  let cells = [];
  let me = { x: 0, y: 0 };
  let moves = 0;
  let par = 0;
  let over = false;

  const build = () => {
    cells = [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        cells.push({ x, y, t: true, r: true, b: true, l: true, visited: false });
      }
    }
    const stack = [];
    const at = (x, y) => cells[y * n + x];
    let curr = at(0, 0);
    curr.visited = true;

    while (true) {
      const { x, y } = curr;
      const unvisited = [];
      if (y > 0 && !at(x, y - 1).visited) unvisited.push({ dir: 't', opp: 'b', c: at(x, y - 1) });
      if (x < n - 1 && !at(x + 1, y).visited) unvisited.push({ dir: 'r', opp: 'l', c: at(x + 1, y) });
      if (y < n - 1 && !at(x, y + 1).visited) unvisited.push({ dir: 'b', opp: 't', c: at(x, y + 1) });
      if (x > 0 && !at(x - 1, y).visited) unvisited.push({ dir: 'l', opp: 'r', c: at(x - 1, y) });

      if (unvisited.length) {
        const next = unvisited[Math.floor(Math.random() * unvisited.length)];
        curr[next.dir] = false;
        next.c[next.opp] = false;
        next.c.visited = true;
        stack.push(curr);
        curr = next.c;
      } else if (stack.length) {
        curr = stack.pop();
      } else {
        break;
      }
    }

    const dist = new Array(n * n).fill(-1);
    const q = [0];
    dist[0] = 0;
    for (let i = 0; i < q.length; i++) {
      const u = q[i];
      const cx = u % n, cy = Math.floor(u / n);
      const c = at(cx, cy);
      if (!c.t && dist[u - n] < 0) { dist[u - n] = dist[u] + 1; q.push(u - n); }
      if (!c.r && dist[u + 1] < 0) { dist[u + 1] = dist[u] + 1; q.push(u + 1); }
      if (!c.b && dist[u + n] < 0) { dist[u + n] = dist[u] + 1; q.push(u + n); }
      if (!c.l && dist[u - 1] < 0) { dist[u - 1] = dist[u] + 1; q.push(u - 1); }
    }
    par = Math.max(1, dist[n * n - 1]);
    me = { x: 0, y: 0 };
    moves = 0;
    over = false;
  };

  const draw = () => {
    const W = 340;
    const pad = 12;
    const S = (W - pad * 2) / n;
    sess.stage.innerHTML =
      '<p class="arc-note">Reach the goal in the corner. Study your path at junctions before you step.</p>' +
      `<div class="arc-mz-wrap"><canvas class="arc-mz-cvs" width="${W}" height="${W}"></canvas></div>` +
      padHTML(false);

    const cvs = sess.stage.querySelector('.arc-mz-cvs');
    if (!cvs) return;
    const g = cvs.getContext('2d');
    g.clearRect(0, 0, W, W);

    g.fillStyle = '#0a1426';
    g.fillRect(pad, pad, W - pad * 2, W - pad * 2);

    g.fillStyle = '#ffb80033';
    g.fillRect(pad + (n - 1) * S + 2, pad + (n - 1) * S + 2, S - 4, S - 4);
    g.font = `${Math.floor(S * 0.55)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🏁', pad + (n - 0.5) * S, pad + (n - 0.5) * S);

    g.strokeStyle = '#2d3f66';
    g.lineWidth = Math.max(2, Math.floor(S * 0.08));
    g.lineCap = 'round';
    g.beginPath();
    for (const c of cells) {
      const x0 = pad + c.x * S, y0 = pad + c.y * S;
      const x1 = x0 + S, y1 = y0 + S;
      if (c.t) { g.moveTo(x0, y0); g.lineTo(x1, y0); }
      if (c.r) { g.moveTo(x1, y0); g.lineTo(x1, y1); }
      if (c.b) { g.moveTo(x0, y1); g.lineTo(x1, y1); }
      if (c.l) { g.moveTo(x0, y0); g.lineTo(x0, y1); }
    }
    g.stroke();

    g.fillStyle = '#ffb800';
    g.beginPath();
    g.arc(pad + (me.x + 0.5) * S, pad + (me.y + 0.5) * S, S * 0.32, 0, Math.PI * 2);
    g.fill();
    sess.hudRefresh();
  };

  const step = dir => {
    if (over || sess.done || CUR !== sess) return;
    const curr = cells[me.y * n + me.x];
    let ok = false;
    if (dir === 'up' && !curr.t && me.y > 0) { me.y--; ok = true; }
    else if (dir === 'down' && !curr.b && me.y < n - 1) { me.y++; ok = true; }
    else if (dir === 'left' && !curr.l && me.x > 0) { me.x--; ok = true; }
    else if (dir === 'right' && !curr.r && me.x < n - 1) { me.x++; ok = true; }

    if (!ok) {
      say('A wall blocks that turn.', 'info');
      shake(sess.stage);
      return;
    }
    moves++;
    draw();
    if (me.x === n - 1 && me.y === n - 1) {
      over = true;
      const extra = Math.max(0, moves - par);
      const pct = clamp(100 - extra * 2, 10, 100);
      endRound(sess, true, pct, [
        `Reached the exit in ${moves} moves. Par was ${par}.`,
        extra === 0 ? 'Optimal path! You did not backtrack once.' : `Backtracked ${extra} extra step${extra === 1 ? '' : 's'}.`,
        'Reading full corridors ahead saves steps at junctions.'
      ]);
    }
  };

  sess.listen(document, 'keydown', e => {
    if (CUR !== sess || sess.done || over) return;
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    const d = keyDir(e);
    if (d) { e.preventDefault(); step(d); }
  });
  sess.listen(sess.stage, 'click', e => {
    const b = e.target.closest('[data-mv]');
    if (b) step(b.dataset.mv);
  });
  sess.stats = () => [['Moves', moves], ['Par', par], ['Size', `${n}×${n}`]];
  build();
  draw();
}
function hvJigGrid(v) {
  const s = String(v || '3');
  if (s === '128') return { cols: 8, rows: 16 };
  const k = Math.max(2, Math.min(8, +s || 3));
  return { cols: k, rows: k };
}

function gameJigsaw(sess) {
  const grid = hvJigGrid(sess.cfg.pieces);
  const cols = grid.cols, rows = grid.rows;
  const N = cols * rows;
  const showRef = sess.cfg.ref || 'full';
  const hasTimer = sess.cfg.timer === 'on';
  const cell = cols >= 8 ? 46 : Math.floor(380 / cols);
  const BW = cols * cell, BH = rows * cell;
  const pad = cell * 0.35;
  const pSize = cell + pad * 2;
  const S = 2;
  let mistakes = 0, placed = 0, elapsed = 0;

  sess.stage.innerHTML = '<p class="arc-note">🎨 Preparing your jigsaw from this idea…</p>';

  withArt(sess.idea, seedOf(sess.id), 480, 480, srcCvs => {
    if (CUR !== sess || sess.done) return;

    // Fill the board with the picture, cropping instead of stretching.
    const full = document.createElement('canvas');
    full.width = BW * S; full.height = BH * S;
    const fg = full.getContext('2d');
    const sc = Math.max(full.width / srcCvs.width, full.height / srcCvs.height);
    const dw = srcCvs.width * sc, dh = srcCvs.height * sc;
    fg.drawImage(srcCvs, (full.width - dw) / 2, (full.height - dh) / 2, dw, dh);
    const refImg = full.toDataURL('image/png');

    const hEdges = [], vEdges = [];
    for (let r = 0; r < rows; r++) {
      hEdges[r] = [];
      for (let c = 0; c < cols - 1; c++) hEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
    }
    for (let r = 0; r < rows - 1; r++) {
      vEdges[r] = [];
      for (let c = 0; c < cols; c++) vEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
    }

    const pathFor = (g, top, right, bottom, left, x, y, w) => {
      g.beginPath();
      g.moveTo(x, y);
      if (!top) g.lineTo(x + w, y);
      else {
        g.lineTo(x + w * 0.35, y);
        g.bezierCurveTo(x + w * 0.35, y - top * w * 0.25, x + w * 0.65, y - top * w * 0.25, x + w * 0.65, y);
        g.lineTo(x + w, y);
      }
      if (!right) g.lineTo(x + w, y + w);
      else {
        g.lineTo(x + w, y + w * 0.35);
        g.bezierCurveTo(x + w + right * w * 0.25, y + w * 0.35, x + w + right * w * 0.25, y + w * 0.65, x + w, y + w * 0.65);
        g.lineTo(x + w, y + w);
      }
      if (!bottom) g.lineTo(x, y + w);
      else {
        g.lineTo(x + w * 0.65, y + w);
        g.bezierCurveTo(x + w * 0.65, y + w + bottom * w * 0.25, x + w * 0.35, y + w + bottom * w * 0.25, x + w * 0.35, y + w);
        g.lineTo(x, y + w);
      }
      if (!left) g.closePath();
      else {
        g.lineTo(x, y + w * 0.65);
        g.bezierCurveTo(x - left * w * 0.25, y + w * 0.65, x - left * w * 0.25, y + w * 0.35, x, y + w * 0.35);
        g.closePath();
      }
    };

    const pieces = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const top = r === 0 ? 0 : -vEdges[r - 1][c];
        const right = c === cols - 1 ? 0 : hEdges[r][c];
        const bottom = r === rows - 1 ? 0 : vEdges[r][c];
        const left = c === 0 ? 0 : -hEdges[r][c - 1];
        const cvs = document.createElement('canvas');
        cvs.width = Math.round(pSize * S);
        cvs.height = Math.round(pSize * S);
        const g = cvs.getContext('2d');
        g.setTransform(S, 0, 0, S, 0, 0);
        pathFor(g, top, right, bottom, left, pad, pad, cell);
        g.save();
        g.clip();
        g.drawImage(full, (c * cell - pad) * S, (r * cell - pad) * S, pSize * S, pSize * S, 0, 0, pSize, pSize);
        g.restore();
        g.strokeStyle = 'rgba(255,255,255,0.55)';
        g.lineWidth = 1.2;
        pathFor(g, top, right, bottom, left, pad, pad, cell);
        g.stroke();
        pieces.push({ idx, cvs, placed: false });
      }
    }

    const order = shuffle(pieces.map(p => p.idx));
    const refMax = 150;
    const refW = Math.round(refMax * cols / Math.max(cols, rows));
    const refH = Math.round(refMax * rows / Math.max(cols, rows));
    let guides = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        guides += `<div class="arc-jig-slot" style="position:absolute;left:${c * cell}px;top:${r * cell}px;width:${cell}px;height:${cell}px;box-sizing:border-box;aspect-ratio:auto"></div>`;
      }
    }

    sess.stage.innerHTML =
      '<p class="arc-note">Drag each piece onto its true spot. A wrong piece stays where you leave it, so you can move it.</p>' +
      (showRef === 'full' ? `<div class="arc-jig-ref" style="text-align:center;margin:8px auto"><img src="${refImg}" alt="Goal picture" style="width:${refW}px;height:${refH}px;border-radius:10px;display:block;margin:0 auto"><span>Goal picture</span></div>` : '') +
      `<div class="arc-jig-board" data-hv-fixed="1" style="position:relative;display:block;box-sizing:content-box;width:${BW}px;height:${BH}px;margin:12px auto;padding:0;background:#0b1326;border-radius:10px">` +
      (showRef === 'dimmed' ? `<div style="position:absolute;inset:0;background:url(${refImg}) center/100% 100%;opacity:.28;pointer-events:none;border-radius:10px"></div>` : '') +
      guides +
      '</div>' +
      '<div class="arc-jig-tray" style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px;max-width:640px;margin:10px auto 0"></div>';

    const tray = sess.stage.querySelector('.arc-jig-tray');
    const board = sess.stage.querySelector('.arc-jig-board');

    order.forEach(i => {
      const p = pieces[i];
      const wrap = document.createElement('div');
      wrap.className = 'arc-jig-p';
      wrap.dataset.pid = i;
      wrap.style.cssText = `position:relative;width:${pSize}px;height:${pSize}px;cursor:grab;touch-action:none;user-select:none`;
      p.cvs.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none';
      wrap.appendChild(p.cvs);
      tray.appendChild(wrap);
    });

    if (hasTimer) {
      sess.every(() => {
        if (CUR !== sess || sess.done) return;
        elapsed++;
        sess.hudRefresh();
      }, 1000);
    }

    sess.stats = () => {
      const s = [['Placed', `${placed}/${N}`], ['Mistakes', mistakes]];
      if (hasTimer) s.push(['Time', mmss(elapsed)]);
      return s;
    };
    sess.hudRefresh();

    let drag = null;

    sess.listen(sess.stage, 'pointerdown', e => {
      if (CUR !== sess || sess.done) return;
      const wrap = e.target.closest('.arc-jig-p');
      if (!wrap || wrap.classList.contains('locked')) return;
      const pid = +wrap.dataset.pid;
      if (pieces[pid].placed) return;
      e.preventDefault();
      drag = { wrap, pid, id: e.pointerId, sx: e.clientX, sy: e.clientY };
      wrap.setPointerCapture(e.pointerId);
      wrap.style.zIndex = '50';
      wrap.style.cursor = 'grabbing';
    });

    // The piece follows the finger or cursor exactly, by moving it with transform.
    sess.listen(sess.stage, 'pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      drag.wrap.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    sess.listen(sess.stage, 'pointerup', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      const wrap = d.wrap, pid = d.pid;

      const rect = wrap.getBoundingClientRect();
      const bRect = board.getBoundingClientRect();
      const px = rect.left - bRect.left;
      const py = rect.top - bRect.top;
      wrap.style.transform = '';
      wrap.style.cursor = 'grab';

      const cx = px + pad + cell / 2;
      const cy = py + pad + cell / 2;
      const inside = cx >= 0 && cy >= 0 && cx < BW && cy < BH;

      if (!inside) {
        // Dropped away from the board: the piece goes back to the tray with no penalty.
        tray.appendChild(wrap);
        wrap.style.position = 'relative';
        wrap.style.left = '';
        wrap.style.top = '';
        wrap.style.zIndex = '';
        return;
      }

      const col = Math.floor(cx / cell);
      const row = Math.floor(cy / cell);
      const p = pieces[pid];

      if (row * cols + col === pid) {
        p.placed = true;
        placed++;
        wrap.classList.add('locked');
        wrap.style.cursor = 'default';
        wrap.style.position = 'absolute';
        wrap.style.left = `${col * cell - pad}px`;
        wrap.style.top = `${row * cell - pad}px`;
        wrap.style.zIndex = '3';
        board.appendChild(wrap);
        say('Piece locked in place.', 'ok');
        sess.hudRefresh();

        if (placed === N) {
          const pct = clamp(100 - mistakes * 3, 20, 100);
          endRound(sess, true, pct, [
            `All ${N} pieces assembled.`,
            mistakes === 0 ? 'Flawless. Every piece found its place first time.' : `${mistakes} wrong placement${mistakes === 1 ? '' : 's'}.`,
            hasTimer ? `Finished in ${mmss(elapsed)}.` : 'Corners and edges first make the frame easier.'
          ]);
        }
      } else {
        // Wrong spot: the piece stays where it was dropped, with no snap-back and no shake.
        mistakes++;
        wrap.style.position = 'absolute';
        wrap.style.left = `${px}px`;
        wrap.style.top = `${py}px`;
        wrap.style.zIndex = '2';
        board.appendChild(wrap);
        say('Not this spot. Leave it there, or move it to its true place.', 'warn');
        sess.hudRefresh();
      }
    });
  });
}

function gameJigsawOld(sess) {
  const k = +sess.cfg.pieces || 3;
  const N = k * k;
  const showRef = sess.cfg.ref || 'full';
  const hasTimer = sess.cfg.timer === 'on';
  let mistakes = 0;
  let placed = 0;
  let elapsed = 0;
  let timerId = null;

  sess.stage.innerHTML = '<p class="arc-note">🎨 Preparing your custom jigsaw from this idea…</p>';

  withArt(sess.idea, seedOf(sess.id), 480, 480, srcCvs => {
    if (CUR !== sess || sess.done) return;
    const W = 360;
    const cellW = W / k;
    const pad = cellW * 0.35;
    const pieceSize = cellW + pad * 2;

    const hEdges = [];
    for (let r = 0; r < k; r++) {
      hEdges[r] = [];
      for (let c = 0; c < k - 1; c++) {
        hEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
      }
    }
    const vEdges = [];
    for (let r = 0; r < k - 1; r++) {
      vEdges[r] = [];
      for (let c = 0; c < k; c++) {
        vEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
      }
    }

    const pathFor = (g, top, right, bottom, left, x, y, w) => {
      g.beginPath();
      g.moveTo(x, y);
      if (!top) g.lineTo(x + w, y);
      else {
        g.lineTo(x + w * 0.35, y);
        g.bezierCurveTo(x + w * 0.35, y - top * w * 0.25, x + w * 0.65, y - top * w * 0.25, x + w * 0.65, y);
        g.lineTo(x + w, y);
      }
      if (!right) g.lineTo(x + w, y + w);
      else {
        g.lineTo(x + w, y + w * 0.35);
        g.bezierCurveTo(x + w + right * w * 0.25, y + w * 0.35, x + w + right * w * 0.25, y + w * 0.65, x + w, y + w * 0.65);
        g.lineTo(x + w, y + w);
      }
      if (!bottom) g.lineTo(x, y + w);
      else {
        g.lineTo(x + w * 0.65, y + w);
        g.bezierCurveTo(x + w * 0.65, y + w + bottom * w * 0.25, x + w * 0.35, y + w + bottom * w * 0.25, x + w * 0.35, y + w);
        g.lineTo(x, y + w);
      }
      if (!left) g.closePath();
      else {
        g.lineTo(x, y + w * 0.65);
        g.bezierCurveTo(x - left * w * 0.25, y + w * 0.65, x - left * w * 0.25, y + w * 0.35, x, y + w * 0.35);
        g.closePath();
      }
    };

    const pieces = [];
    for (let r = 0; r < k; r++) {
      for (let c = 0; c < k; c++) {
        const idx = r * k + c;
        const top = r === 0 ? 0 : -vEdges[r - 1][c];
        const right = c === k - 1 ? 0 : hEdges[r][c];
        const bottom = r === k - 1 ? 0 : vEdges[r][c];
        const left = c === 0 ? 0 : -hEdges[r][c - 1];

        const cvs = document.createElement('canvas');
        cvs.width = pieceSize;
        cvs.height = pieceSize;
        const g = cvs.getContext('2d');

        pathFor(g, top, right, bottom, left, pad, pad, cellW);
        g.save();
        g.clip();
        const srcScale = srcCvs.width / W;
        const sx = (c * cellW - pad) * srcScale;
        const sy = (r * cellW - pad) * srcScale;
        const sw = pieceSize * srcScale;
        const sh = pieceSize * srcScale;
        g.drawImage(srcCvs, sx, sy, sw, sh, 0, 0, pieceSize, pieceSize);
        g.restore();

        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = 1.5;
        pathFor(g, top, right, bottom, left, pad, pad, cellW);
        g.stroke();

        pieces.push({ idx, r, c, cvs, placed: false });
      }
    }

    const order = shuffle(pieces.map(p => p.idx));
    const refImg = srcCvs.toDataURL('image/png');

    sess.stage.innerHTML =
      '<p class="arc-note">Drag each jigsaw piece onto its true spot on the board.</p>' +
      (showRef === 'full' ? `<div class="arc-jig-ref"><img src="${refImg}" alt="Reference"><span>Goal picture</span></div>` : '') +
      `<div class="arc-jig-board${showRef === 'dimmed' ? ' dimmed' : ''}" style="width:${W}px;height:${W}px;${showRef === 'dimmed' ? `background-image:url(${refImg})` : ''}">` +
      range(N).map(i => `<div class="arc-jig-slot" data-slot="${i}" style="width:${cellW}px;height:${cellW}px"></div>`).join('') +
      '</div>' +
      '<div class="arc-jig-tray"></div>';

    const tray = sess.stage.querySelector('.arc-jig-tray');
    const board = sess.stage.querySelector('.arc-jig-board');

    order.forEach(i => {
      const p = pieces[i];
      const wrap = document.createElement('div');
      wrap.className = 'arc-jig-p';
      wrap.dataset.pid = i;
      p.cvs.style.width = '100%';
      p.cvs.style.height = '100%';
      wrap.appendChild(p.cvs);
      tray.appendChild(wrap);
    });

    if (hasTimer) {
      timerId = sess.every(() => {
        if (CUR !== sess || sess.done) return;
        elapsed++;
        sess.hudRefresh();
      }, 1000);
    }

    sess.stats = () => {
      const s = [['Placed', `${placed}/${N}`], ['Mistakes', mistakes]];
      if (hasTimer) s.push(['Time', mmss(elapsed)]);
      return s;
    };
    sess.hudRefresh();

    let drag = null;
    sess.listen(sess.stage, 'pointerdown', e => {
      if (CUR !== sess || sess.done) return;
      const pWrap = e.target.closest('.arc-jig-p');
      if (!pWrap || pWrap.classList.contains('locked')) return;
      const pid = +pWrap.dataset.pid;
      const p = pieces[pid];
      if (p.placed) return;

      e.preventDefault();
      pWrap.setPointerCapture(e.pointerId);
      const rect = pWrap.getBoundingClientRect();
      pWrap.classList.add('dragging');
      drag = {
        wrap: pWrap,
        pid,
        id: e.pointerId,
        ox: e.clientX - rect.left,
        oy: e.clientY - rect.top
      };
    });

    sess.listen(sess.stage, 'pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.wrap.style.left = `${e.clientX - drag.ox}px`;
      drag.wrap.style.top = `${e.clientY - drag.oy}px`;
    });

    sess.listen(sess.stage, 'pointerup', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const { wrap, pid } = drag;
      drag = null;
      wrap.classList.remove('dragging');
      wrap.style.left = '';
      wrap.style.top = '';

      const bRect = board.getBoundingClientRect();
      const dropX = e.clientX - bRect.left;
      const dropY = e.clientY - bRect.top;

      if (dropX < 0 || dropY < 0 || dropX > W || dropY > W) return;

      const col = Math.floor(dropX / cellW);
      const row = Math.floor(dropY / cellW);
      const slotIdx = row * k + col;
      const p = pieces[pid];

      if (slotIdx === pid) {
        p.placed = true;
        placed++;
        wrap.classList.add('locked');
        wrap.style.position = 'absolute';
        wrap.style.left = `${col * cellW - pad}px`;
        wrap.style.top = `${row * cellW - pad}px`;
        wrap.style.width = `${pieceSize}px`;
        wrap.style.height = `${pieceSize}px`;
        board.appendChild(wrap);
        say('Piece locked in place.', 'ok');
        sess.hudRefresh();

        if (placed === N) {
          const pct = clamp(100 - mistakes * 5, 20, 100);
          endRound(sess, true, pct, [
            `All ${N} jigsaw pieces assembled.`,
            mistakes === 0 ? 'Flawless assembly! Zero misplacements.' : `${mistakes} wrong drop${mistakes === 1 ? '' : 's'}.`,
            hasTimer ? `Finished in ${mmss(elapsed)}.` : 'Corner and edge pieces give you the frame to build within.'
          ]);
        }
      } else {
        mistakes++;
        say('Does not match that slot. Look at the edges.', 'warn');
        shake(wrap);
        sess.hudRefresh();
      }
    });
  });
}
function gameRubik(sess) {
  const spins = +sess.cfg.spins || 6;
  const par = Math.ceil(spins * 1.5);
  const g = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  let moves = 0;
  let over = false;
  let artUrl = '';

  const solved = () => g.every((v, i) => v === i);

  const shiftRow = (r, d) => {
    const row = [g[r * 3], g[r * 3 + 1], g[r * 3 + 2]];
    for (let c = 0; c < 3; c++) g[r * 3 + ((c + d + 3) % 3)] = row[c];
  };

  const shiftCol = (c, d) => {
    const col = [g[c], g[3 + c], g[6 + c]];
    for (let r = 0; r < 3; r++) g[((r + d + 3) % 3) * 3 + c] = col[r];
  };

  const apply = (kind, idx, dir) => {
    if (kind === 'row') shiftRow(idx, dir === 'right' ? 1 : -1);
    else shiftCol(idx, dir === 'down' ? 1 : -1);
  };

  const scramble = () => {
    let prev = null;
    for (let i = 0; i < spins; i++) {
      let m;
      do {
        const kind = Math.random() < 0.5 ? 'row' : 'col';
        const idx = Math.floor(Math.random() * 3);
        const dir = kind === 'row'
          ? (Math.random() < 0.5 ? 'left' : 'right')
          : (Math.random() < 0.5 ? 'up' : 'down');
        m = { kind, idx, dir };
      } while (prev && prev.kind === m.kind && prev.idx === m.idx && prev.dir !== m.dir);
      apply(m.kind, m.idx, m.dir);
      prev = m;
    }
    if (solved()) apply('row', 0, 'right');
  };

  const render = () => {
    const cells = ['<span></span>'];
    for (let c = 0; c < 3; c++) cells.push(arrowEl('col', c, 'up', '▲'));
    cells.push('<span></span>');
    for (let r = 0; r < 3; r++) {
      cells.push(arrowEl('row', r, 'left', '◀'));
      for (let c = 0; c < 3; c++) {
        const i = r * 3 + c;
        const v = g[i];
        const x = v % 3, y = Math.floor(v / 3);
        const ok = v === i ? ' ok' : '';
        cells.push(
          `<div class="arc-rb-tile${ok}" style="background-image:url('${artUrl}');background-size:300% 300%;background-position:${x * 50}% ${y * 50}%"></div>`
        );
      }
      cells.push(arrowEl('row', r, 'right', '▶'));
    }
    cells.push('<span></span>');
    for (let c = 0; c < 3; c++) cells.push(arrowEl('col', c, 'down', '▼'));
    cells.push('<span></span>');
    sess.stage.innerHTML =
      '<p class="arc-note">Slide a row or column with its arrow until the picture is whole. Tiles glow when they sit in place.</p>' +
      `<div class="arc-rb">${cells.join('')}</div>`;
    sess.hudRefresh();
  };

  sess.stats = () => [['Moves', moves], ['Par', par], ['Spins', spins]];
  sess.stage.innerHTML = '<div class="arc-loading">🎨 Painting your picture…</div>';

  sess.listen(sess.stage, 'click', e => {
    const b = e.target.closest('[data-rb-kind]');
    if (!b || over || sess.done || CUR !== sess || !artUrl) return;
    apply(b.dataset.rbKind, +b.dataset.rbIdx, b.dataset.rbDir);
    moves++;
    render();
    if (solved()) {
      over = true;
      const pct = clamp(100 - 5 * Math.max(0, moves - par), 10, 100);
      endRound(sess, true, pct, [
        `Whole again in ${moves} moves. Par was ${par}.`,
        moves <= par
          ? 'Par met: you reversed the scramble cleanly.'
          : `${moves - par} extra moves. Before each slide, decide which tile must reach its spot next.`,
        'Work on one row at a time, then the columns. Each move should fix something.'
      ]);
    }
  });

  withArt(sess.idea, seedOf('rubik'), 480, 480, cv => {
    if (CUR !== sess || sess.done) return;
    artUrl = cv.toDataURL('image/png');
    scramble();
    render();
  });
}
function gameMemory(sess) {
  const count = +sess.cfg.symbols || 6;
  const cols = count === 12 ? 4 : 3;
  const memSecs = +sess.cfg.memorise || 8;
  const peeksMax = +sess.cfg.peeks || 2;
  const picks = shuffle([...SYMBOLS]).slice(0, count);
  const cellSym = shuffle([...picks]);
  const tray = shuffle([...picks]);
  const placed = new Array(count).fill(null);
  let phase = 'memo';
  let secsLeft = memSecs;
  let revealed = false;
  let selected = null;
  let correct = 0;
  let wrong = 0;
  let peeks = 0;
  let over = false;

  const pct = () => clamp(Math.round((correct / count) * 100 - wrong * 10 - peeks * 10), 0, 100);

  const finish = win => {
    if (over) return;
    over = true;
    const p = pct();
    endRound(sess, win && correct === count && p >= 60, p, [
      `You placed ${correct} of ${count} symbols in the right cell.`,
      wrong ? `${wrong} wrong placement${wrong === 1 ? '' : 's'} cost 10 points each.` : 'No wrong placements.',
      peeks ? `${peeks} peek${peeks === 1 ? '' : 's'} cost 10 points each. Try grouping symbols by their neighbours.` : 'You rebuilt the map without peeking.',
      'Link each symbol to a landmark next to it, the way you remember a route.'
    ]);
  };

  const render = () => {
    let note = '';
    let body = '';
    if (phase === 'memo' || revealed) {
      note = phase === 'memo'
        ? `Memorise where each symbol sits. ${secsLeft}s left.`
        : 'Peek: the full map for two seconds.';
      body = `<div class="arc-mm" style="grid-template-columns:repeat(${cols},1fr)">` +
        cellSym.map(s => `<div class="arc-mm-cell shown">${s}</div>`).join('') +
        '</div>';
    } else {
      note = selected
        ? `Now tap the cell where ${selected} sat.`
        : 'Pick a symbol from the tray, then tap the cell where it sat.';
      const cells = placed.map((s, i) => s
        ? `<div class="arc-mm-cell ok">${s}</div>`
        : `<button class="arc-mm-cell" data-cell="${i}"></button>`).join('');
      const syms = tray.filter(s => !placed.includes(s)).map(s =>
        `<button class="arc-mm-sym${selected === s ? ' sel' : ''}" data-sym="${s}">${s}</button>`).join('');
      body = `<div class="arc-mm" style="grid-template-columns:repeat(${cols},1fr)">${cells}</div>` +
        `<div class="arc-mm-tray">${syms || '<span class="arc-note">All placed!</span>'}</div>` +
        '<div class="arc-row"><button class="arc-btn" data-peek="1">👁 Peek (−10)</button></div>';
    }
    sess.stage.innerHTML =
      `<p class="arc-note">${note}</p>${body}` +
      '<div class="arc-row"><button class="arc-btn" data-end="1">⏹ End game</button></div>';
    sess.hudRefresh();
  };

  sess.stats = () => [
    ['Placed', `${correct}/${count}`],
    ['Wrong', wrong],
    ['Peeks left', Math.max(0, peeksMax - peeks)]
  ];

  sess.every(() => {
    if (over || sess.done || phase !== 'memo') return;
    secsLeft--;
    if (secsLeft <= 0) phase = 'rebuild';
    render();
  }, 1000);

  sess.listen(sess.stage, 'click', e => {
    if (over || sess.done || CUR !== sess) return;
    if (e.target.closest('[data-end]')) { finish(false); return; }

    if (e.target.closest('[data-peek]')) {
      if (phase !== 'rebuild' || revealed) return;
      if (peeks >= peeksMax) { say('No peeks left this round.', 'warn'); return; }
      peeks++;
      revealed = true;
      say('Peek used: −10 points. Use it wisely.', 'warn');
      render();
      sess.later(() => {
        if (over || sess.done) return;
        revealed = false;
        render();
      }, 2000);
      return;
    }

    const symBtn = e.target.closest('[data-sym]');
    if (symBtn) {
      if (phase !== 'rebuild' || revealed) return;
      const s = symBtn.dataset.sym;
      selected = selected === s ? null : s;
      render();
      return;
    }

    const cell = e.target.closest('[data-cell]');
    if (cell) {
      if (phase !== 'rebuild' || revealed) return;
      if (!selected) { say('Pick a symbol from the tray first.', 'info'); return; }
      const i = +cell.dataset.cell;
      if (cellSym[i] === selected) {
        placed[i] = selected;
        correct++;
        selected = null;
        say('That is where it sat.', 'ok');
        render();
        if (correct === count) finish(true);
      } else {
        wrong++;
        say('Not that cell. Look at the map again.', 'warn');
        shake(cell);
        sess.hudRefresh();
      }
    }
  });

  render();
}
function gamePlan(sess) {
  const steps = planSteps(sess.idea);
  const total = steps.length;
  const live = sess.cfg.feedback === 'live';
  let order = shuffle(steps.map((_, i) => i));
  if (order.every((v, i) => v === i)) order = [order[1], order[0], ...order.slice(2)];
  let revealed = false;
  let over = false;

  const rightCount = () => order.reduce((n, v, i) => n + (v === i ? 1 : 0), 0);
  const scorePct = () => clamp(Math.round((rightCount() / total) * 100) - (revealed ? 10 : 0), 0, 100);

  sess.stats = () => [
    ['Right spot', `${rightCount()}/${total}`],
    ['Answer shown', revealed ? 'Yes' : 'No']
  ];

  const render = () => {
    const cards = order.map((v, i) => {
      const s = steps[v];
      let cls = 'arc-pl-card';
      if (revealed || live) cls += v === i ? ' ok' : ' bad';
      const when = s.when ? ` · ${esc(whenText(s.when))}` : '';
      return `<div class="${cls}">` +
        `<span class="arc-pl-n">${i + 1}</span>` +
        `<span class="arc-pl-txt">${esc(s.text)}${when}</span>` +
        `<span class="arc-pl-mv">` +
        `<button class="arc-btn" data-up="${i}" aria-label="Move up">▲</button>` +
        `<button class="arc-btn" data-down="${i}" aria-label="Move down">▼</button>` +
        `</span></div>`;
    }).join('');

    sess.stage.innerHTML =
      `<p class="arc-note">${live
        ? 'Green means the step is in the right place. Red means it is not yet.'
        : 'Put the steps in the order they should happen. Check when you are ready.'}</p>` +
      `<div class="arc-pl">${cards}</div>` +
      '<div class="arc-row">' +
      '<button class="arc-btn" data-check="1">✓ Check my order</button>' +
      `<button class="arc-btn" data-show="1"${revealed ? ' disabled' : ''}>👁 Show correct order (−10)</button>` +
      '</div>';
    sess.hudRefresh();
  };

  const move = (i, d) => {
    if (over) return;
    const j = i + d;
    if (j < 0 || j >= total) return;
    [order[i], order[j]] = [order[j], order[i]];
    render();
  };

  const finishPlan = () => {
    if (over) return;
    over = true;
    const p = scorePct();
    const right = rightCount();
    endRound(sess, p >= 60, p, [
      `${right} of ${total} steps were in the right place.`,
      right < total
        ? 'Ask of each step: what must already be done before this one?'
        : 'Every step was in the right place.',
      revealed
        ? 'Seeing the correct order cost 10 points. Next time, place the first and last steps before the middle.'
        : 'You checked without seeing the answer. That is how the reasoning sticks.',
      'Look for the step that unlocks the others and place it first.'
    ]);
  };

  sess.listen(sess.stage, 'click', e => {
    if (over || sess.done || CUR !== sess) return;
    const up = e.target.closest('[data-up]');
    if (up) { move(+up.dataset.up, -1); return; }
    const down = e.target.closest('[data-down]');
    if (down) { move(+down.dataset.down, 1); return; }
    if (e.target.closest('[data-show]')) {
      if (revealed) return;
      revealed = true;
      say('Correct order shown: −10 points.', 'warn');
      render();
      return;
    }
    if (e.target.closest('[data-check]')) finishPlan();
  });

  render();
}
function gameRoute(sess) {
  const n = +sess.cfg.grid || 7;
  const N = n * n;
  const terrain = sess.cfg.terrain || 'standard';
  const mudCount = { light: 3, standard: 5, dense: 8 }[terrain] || 5;
  const wallCount = { light: 3, standard: 5, dense: 7 }[terrain] || 5;
  const start = 0;
  const goal = N - 1;
  let wall = [];
  let cost = [];
  let best = 0;
  let bestPath = [];
  let path = [start];
  let shownBest = false;
  let over = false;

  const taken = () => path.slice(1).reduce((s, c) => s + cost[c], 0);

  const build = () => {
    for (let tries = 0; tries < 300; tries++) {
      const w = new Array(N).fill(false);
      const c = new Array(N).fill(1);
      const open = [];
      for (let i = 1; i < N - 1; i++) open.push(i);
      const mixed = shuffle(open);
      mixed.slice(0, wallCount).forEach(i => { w[i] = true; });
      mixed.slice(wallCount, wallCount + mudCount).forEach(i => { c[i] = 3; });
      const r = cheapest(w, c, n);
      if (r) {
        wall = w;
        cost = c;
        best = r.cost;
        bestPath = r.path;
        return;
      }
    }
    wall = new Array(N).fill(false);
    cost = new Array(N).fill(1);
    const r = cheapest(wall, cost, n);
    best = r ? r.cost : 0;
    bestPath = r ? r.path : [];
  };

  const render = () => {
    const onPath = new Map(path.map((c, i) => [c, i + 1]));
    const bestSet = new Set(shownBest ? bestPath : []);
    let cells = '';
    for (let i = 0; i < N; i++) {
      let cls = 'arc-rt-c';
      let icon = '';
      if (wall[i]) {
        cls += ' wall';
        icon = '⬛';
      } else {
        if (cost[i] > 1) { cls += ' mud'; icon = '🟫'; }
        if (bestSet.has(i) && !onPath.has(i)) cls += ' best';
        if (onPath.has(i)) { cls += ' path'; icon = String(onPath.get(i)); }
        if (i === start) { cls += ' start'; icon = '🏠'; }
        if (i === goal) { cls += ' goal'; icon = '🏁'; }
      }
      cells += `<div class="${cls}" data-rc="${i}">${icon}</div>`;
    }
    sess.stage.innerHTML =
      '<p class="arc-note">Build a route from 🏠 to 🏁, one neighbouring cell at a time. Plain cells cost 1. Mud 🟫 costs 3.</p>' +
      `<div class="arc-rt" style="grid-template-columns:repeat(${n},1fr)">${cells}</div>` +
      `<p class="arc-note">Route cost now: <b>${taken()}</b>${shownBest ? ` · Best possible: <b>${best}</b>` : ''}</p>` +
      '<div class="arc-row">' +
      '<button class="arc-btn" data-undo="1">↶ Undo</button>' +
      `<button class="arc-btn" data-showbest="1"${shownBest ? ' disabled' : ''}>👁 Show best (−10)</button>` +
      '</div>';
    sess.hudRefresh();
  };

  const finishRoute = overflow => {
    if (over) return;
    over = true;
    const t = taken();
    const reached = path[path.length - 1] === goal;
    const p = overflow
      ? 20
      : clamp(100 - 8 * Math.max(0, t - best) - (shownBest ? 10 : 0), 0, 100);
    const tips = overflow
      ? [
          `Your route cost ${t}, more than three times the best of ${best}.`,
          'Stop before each step and compare the dry options against the mud.',
          'Mud costs three times as much, so a longer dry road can be cheaper.'
        ]
      : [
          `Route cost ${t}. Best possible was ${best}.`,
          t === best
            ? 'You found the cheapest route.'
            : `${t - best} extra cost from crossing mud or detouring.`,
          shownBest
            ? 'Seeing the best route cost 10 points.'
            : 'You found the route without a hint.',
          'Mud costs three times as much, so a longer dry road can be cheaper.'
        ];
    endRound(sess, !overflow && reached && p >= 60, p, tips);
  };

  sess.stats = () => [
    ['Cost', taken()],
    ['Best', shownBest ? best : '?'],
    ['Steps', path.length - 1]
  ];

  sess.listen(sess.stage, 'click', e => {
    if (over || sess.done || CUR !== sess) return;
    if (e.target.closest('[data-undo]')) {
      if (path.length > 1) { path.pop(); render(); }
      return;
    }
    if (e.target.closest('[data-showbest]')) {
      if (shownBest) return;
      shownBest = true;
      say('Best route shown: −10 points.', 'warn');
      render();
      return;
    }
    const cellEl = e.target.closest('[data-rc]');
    if (!cellEl) return;
    const c = +cellEl.dataset.rc;
    const last = path[path.length - 1];
    if (wall[c]) {
      say('Walls cannot be crossed.', 'warn');
      shake(cellEl);
      return;
    }
    if (path.length > 1 && c === path[path.length - 2]) {
      path.pop();
      render();
      return;
    }
    if (path.includes(c)) {
      say('That cell is already on your route.', 'info');
      return;
    }
    if (!nbrs(last, n).includes(c)) {
      say('Build the route one neighbouring cell at a time.', 'info');
      shake(cellEl);
      return;
    }
    path.push(c);
    render();
    if (c === goal) { finishRoute(false); return; }
    if (taken() > 3 * best) finishRoute(true);
  });

  build();
  render();
}
const GAME_FN = {
  puzzle: gamePuzzle,
  word: gameWord,
  risk: gameRisk,
  maze: gameMaze,
  jigsaw: gameJigsaw,
  rubik: gameRubik,
  memory: gameMemory,
  plan: gamePlan,
  route: gameRoute
};

const CSS = `
#arcOv.arc-ov{display:none;position:fixed;inset:0;z-index:60;background:rgba(3,7,16,.78);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:16px}
#arcOv.arc-ov.open{display:flex}
.arc-modal{width:min(660px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--panel,#111b2e);border:1px solid var(--line,#22304a);border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.5);color:var(--text,#eef2ff);padding:18px;animation:arcIn .28s ease both}
@keyframes arcIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
.arc-mhead{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.arc-ico{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:24px;background:var(--chip,#1d2a45);flex:0 0 auto;animation:arcBob 2.4s ease-in-out infinite}
@keyframes arcBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
#arcTitle{margin:0;font-size:18px;flex:1;min-width:0}
.arc-x{background:none;border:0;color:var(--muted,#8b97b5);font-size:22px;cursor:pointer;padding:4px 10px;border-radius:10px}
.arc-x:hover{background:var(--chip,#1d2a45);color:var(--text,#eef2ff)}
.arc-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.arc-blurb{color:var(--muted,#8b97b5);font-size:14px;line-height:1.5;margin:0 0 10px}
.arc-set{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.arc-setg{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#8b97b5)}
.arc-setg select{background:var(--chip,#1d2a45);color:var(--text,#eef2ff);border:1px solid var(--line,#22304a);border-radius:10px;padding:7px 10px;font-size:14px;min-width:150px}
.arc-hud{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.arc-chip{background:var(--chip,#1d2a45);border-radius:999px;padding:5px 12px;font-size:13px;color:var(--muted,#8b97b5)}
.arc-chip b{color:var(--accent,#ffb800);margin-left:4px}
.arc-stage{min-height:200px;animation:arcFade .35s ease both}
@keyframes arcFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.arc-note{color:var(--muted,#8b97b5);font-size:14px;line-height:1.5;margin:6px 0 10px;text-align:center}
.arc-note b{color:var(--accent,#ffb800)}
.arc-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:10px 0}
.arc-loading{text-align:center;padding:60px 10px;color:var(--muted,#8b97b5);animation:arcPulse 1.4s ease-in-out infinite}
@keyframes arcPulse{0%,100%{opacity:.5}50%{opacity:1}}
.arc-foot{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px}
.arc-btn{background:var(--chip,#1d2a45);color:var(--text,#eef2ff);border:1px solid var(--line,#22304a);border-radius:12px;padding:9px 14px;font-size:14px;cursor:pointer;transition:transform .12s ease,background .12s ease}
.arc-btn:hover{background:#26375a;transform:translateY(-1px)}
.arc-btn:active{transform:scale(.97)}
.arc-btn.primary{background:var(--accent,#ffb800);color:#1a1200;border-color:transparent;font-weight:700}
.arc-btn:disabled{opacity:.45;cursor:default;transform:none}
.arc-shake{animation:arcShake .42s ease}
@keyframes arcShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(4px)}}
.arc-res{text-align:center;padding:16px 8px;animation:arcIn .4s ease both}
.arc-res[hidden]{display:none}
.arc-res-ico{font-size:44px;animation:arcBob 1.8s ease-in-out infinite}
.arc-res h3{margin:6px 0;font-size:20px}
.arc-res-pct{font-size:34px;font-weight:800;color:var(--accent,#ffb800)}
.arc-res-xp{display:inline-block;margin:4px 0 10px;background:var(--chip,#1d2a45);border-radius:999px;padding:4px 12px;font-size:13px;color:var(--ok,#34d399)}
.arc-tips{text-align:left;margin:10px auto 0;padding-left:20px;max-width:520px;line-height:1.6;color:var(--muted,#8b97b5);font-size:14px}
.arc-res-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px}
.arc-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:10px}
.arc-g{background:var(--chip,#1d2a45);border:1px solid var(--line,#22304a);border-radius:16px;padding:14px;text-align:left;color:var(--text,#eef2ff);cursor:pointer;display:flex;flex-direction:column;gap:4px;font:inherit;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}
.arc-g:hover{transform:translateY(-3px);border-color:var(--accent,#ffb800);box-shadow:0 10px 24px rgba(255,184,0,.12)}
.arc-gi{font-size:30px;line-height:1}
.arc-g b{font-size:15px}
.arc-g small{color:var(--muted,#8b97b5);font-size:12px;line-height:1.4}
.arc-g em{color:var(--accent,#ffb800);font-size:12px;font-style:normal;margin-top:auto}
#play .arc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:14px}
#play .arc-card{background:var(--panel,#111b2e);border:1px solid var(--line,#22304a);border-radius:18px;padding:14px;color:var(--text,#eef2ff);cursor:pointer;display:flex;flex-direction:column;gap:4px;font:inherit;text-align:left;transition:transform .15s ease,border-color .15s ease}
#play .arc-card:hover{transform:translateY(-3px);border-color:var(--accent,#ffb800)}
.arc-cico{font-size:30px;line-height:1;margin-bottom:4px;animation:arcBob 3s ease-in-out infinite}
#play .arc-card b{font-size:15px}
#play .arc-card small{color:var(--muted,#8b97b5);font-size:12px;line-height:1.4}
#play .arc-card em{color:var(--accent,#ffb800);font-size:12px;font-style:normal;margin-top:auto}
.arc-tally{color:var(--muted,#8b97b5);font-size:13px;margin-top:8px}
.arc-pz-wrap{position:relative;width:min(420px,100%);margin:0 auto}
.arc-pz{display:grid;grid-template-columns:repeat(var(--n,3),1fr);gap:6px;width:100%;aspect-ratio:1}
.arc-pz-cell{aspect-ratio:1;width:100%;border:0;border-radius:10px;cursor:pointer;background-color:var(--chip,#1d2a45);background-repeat:no-repeat;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),0 4px 10px rgba(0,0,0,.3);transition:transform .14s ease,filter .14s ease;padding:0}
.arc-pz-cell:hover{transform:scale(1.03);filter:brightness(1.12)}
.arc-pz-cell.blank{background:#0b1326;box-shadow:inset 0 0 0 2px var(--line,#22304a);cursor:default;transform:none;filter:none}
.arc-peek{position:absolute;inset:0;z-index:2;background:#0b1326;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:6px;animation:arcIn .2s ease both}
.arc-peek img{width:100%;height:100%;object-fit:contain;border-radius:12px}
.arc-bank{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0 14px}
.arc-let{background:var(--accent,#ffb800);color:#1a1200;border-radius:9px;padding:6px 9px;font-weight:800;font-size:16px;box-shadow:0 3px 0 #b07f00}
.arc-let sub{font-size:10px;margin-left:2px;opacity:.8}
.arc-wds{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.arc-wd{background:var(--chip,#1d2a45);color:var(--text,#eef2ff);border:1px solid var(--line,#22304a);border-radius:12px;padding:9px 14px;font-size:15px;font-weight:700;letter-spacing:.04em;cursor:pointer;transition:transform .12s ease,background .12s ease}
.arc-wd:hover:not(:disabled){transform:translateY(-2px);border-color:var(--accent,#ffb800)}
.arc-wd.ok{background:rgba(52,211,153,.18);border-color:var(--ok,#34d399);color:var(--ok,#34d399)}
.arc-wd.bad{background:rgba(248,113,113,.16);border-color:var(--bad,#f87171);color:var(--bad,#f87171);text-decoration:line-through}
.arc-wd:disabled{cursor:default;transform:none}
.arc-rk{display:grid;gap:4px;width:min(380px,100%);margin:0 auto;aspect-ratio:1}
.arc-rk-c{border-radius:8px;background:#0e1830;display:grid;place-items:center;font-size:clamp(14px,3vw,22px);transition:background .2s ease}
.arc-rk-c.wall{background:#263250}
.arc-rk-c.threat{background:rgba(248,113,113,.28);box-shadow:inset 0 0 0 1px rgba(248,113,113,.6)}
.arc-rk-c.me{background:rgba(255,184,0,.22);box-shadow:inset 0 0 0 2px var(--accent,#ffb800);animation:arcBob 1.6s ease-in-out infinite}
.arc-rk-c.foe{background:rgba(248,113,113,.4)}
.arc-rk-c.goal{background:rgba(52,211,153,.2)}
.arc-pad{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:12px}
.arc-pad button{min-width:58px;min-height:46px;font-size:20px;background:var(--chip,#1d2a45);color:var(--text,#eef2ff);border:1px solid var(--line,#22304a);border-radius:12px;cursor:pointer}
.arc-pad button:active{transform:scale(.94);background:#26375a}
.arc-mz-wrap{display:flex;justify-content:center}
.arc-mz-cv{width:min(340px,100%);height:auto;aspect-ratio:1;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.arc-jig-ref{display:flex;justify-content:center;margin-bottom:8px}
.arc-jig-ref img{width:min(150px,50%);border-radius:12px;box-shadow:0 8px 20px rgba(0,0,0,.4)}
.arc-jig-board{display:grid;gap:3px;width:min(400px,100%);margin:0 auto;padding:6px;background:#0b1326;border-radius:14px;box-shadow:inset 0 0 0 1px var(--line,#22304a);background-size:cover}
.arc-jig-slot{aspect-ratio:1;border-radius:6px;border:1px dashed rgba(139,151,181,.35);background-repeat:no-repeat;background-position:center;background-size:156% 156%;cursor:pointer;transition:background .15s ease}
.arc-jig-slot:hover{background-color:rgba(255,184,0,.08)}
.arc-jig-slot.locked{border:0;cursor:default;background-size:156% 156% !important;background-position:center !important;animation:arcSnap .35s ease both}
@keyframes arcSnap{0%{transform:scale(1.06)}100%{transform:scale(1)}}
.arc-jig-tray{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px;min-height:84px}
.arc-jig-pc{background:var(--chip,#1d2a45);border:1px solid var(--line,#22304a);border-radius:12px;padding:4px;cursor:pointer;transition:transform .14s ease,border-color .14s ease}
.arc-jig-pc:hover{transform:translateY(-3px)}
.arc-jig-pc.selected{border-color:var(--accent,#ffb800);box-shadow:0 0 0 2px rgba(255,184,0,.35);transform:translateY(-4px)}
.arc-jig-pc img{width:72px;height:72px;display:block}
.arc-rb{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;width:min(360px,100%);margin:0 auto}
.arc-rb>span{display:block}
.arc-arw{background:var(--chip,#1d2a45);color:var(--accent,#ffb800);border:1px solid var(--line,#22304a);border-radius:10px;font-size:16px;cursor:pointer;aspect-ratio:1;display:grid;place-items:center;padding:0;transition:background .12s ease,transform .12s ease}
.arc-arw:hover{background:#26375a;transform:scale(1.08)}
.arc-arw:active{transform:scale(.93)}
.arc-rb-tile{aspect-ratio:1;border-radius:8px;background-repeat:no-repeat;box-shadow:0 3px 8px rgba(0,0,0,.35);transition:box-shadow .25s ease,transform .25s ease}
.arc-rb-tile.ok{box-shadow:0 0 0 2px var(--ok,#34d399),0 3px 8px rgba(0,0,0,.35)}
.arc-mm{display:grid;gap:6px;width:min(340px,100%);margin:0 auto}
.arc-mm-cell{aspect-ratio:1;border-radius:10px;background:var(--chip,#1d2a45);display:grid;place-items:center;font-size:clamp(20px,5vw,30px);border:1px dashed rgba(139,151,181,.4);padding:0;color:inherit;cursor:pointer}
.arc-mm-cell.shown{border:1px solid var(--line,#22304a);cursor:default;animation:arcIn .3s ease both}
.arc-mm-cell.ok{border:1px solid var(--ok,#34d399);cursor:default;animation:arcSnap .3s ease both}
.arc-mm-tray{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:12px 0}
.arc-mm-sym{background:var(--chip,#1d2a45);border:1px solid var(--line,#22304a);border-radius:12px;font-size:24px;padding:6px 10px;cursor:pointer;transition:transform .12s ease}
.arc-mm-sym:hover{transform:translateY(-2px)}
.arc-mm-sym.sel{border-color:var(--accent,#ffb800);box-shadow:0 0 0 2px rgba(255,184,0,.35)}
.arc-pl{display:flex;flex-direction:column;gap:8px;max-width:520px;margin:0 auto}
.arc-pl-card{display:flex;align-items:center;gap:10px;background:var(--chip,#1d2a45);border:1px solid var(--line,#22304a);border-radius:14px;padding:10px 12px;transition:border-color .2s ease,background .2s ease}
.arc-pl-card.ok{border-color:var(--ok,#34d399);background:rgba(52,211,153,.12)}
.arc-pl-card.bad{border-color:var(--bad,#f87171);background:rgba(248,113,113,.1)}
.arc-pl-n{width:28px;height:28px;border-radius:50%;background:var(--panel,#111b2e);display:grid;place-items:center;font-weight:800;color:var(--accent,#ffb800);flex:0 0 auto}
.arc-pl-txt{flex:1;font-size:14px;line-height:1.4}
.arc-pl-mv{display:flex;gap:4px;flex:0 0 auto}
.arc-pl-mv .arc-btn{padding:5px 9px}
.arc-rt{display:grid;gap:3px;width:min(400px,100%);margin:0 auto}
.arc-rt-c{aspect-ratio:1;border-radius:7px;background:#0e1830;display:grid;place-items:center;font-size:clamp(11px,2.6vw,16px);cursor:pointer;font-weight:800;color:var(--text,#eef2ff);transition:background .15s ease,transform .12s ease}
.arc-rt-c:hover{transform:scale(1.06)}
.arc-rt-c.wall{background:#263250;cursor:not-allowed;transform:none}
.arc-rt-c.mud{background:rgba(180,120,60,.3)}
.arc-rt-c.best{box-shadow:inset 0 0 0 2px rgba(255,184,0,.7);background:rgba(255,184,0,.12)}
.arc-rt-c.path{background:rgba(52,211,153,.3);box-shadow:inset 0 0 0 1px var(--ok,#34d399)}
.arc-rt-c.start{background:rgba(96,165,250,.25)}
.arc-rt-c.goal{background:rgba(255,184,0,.25)}
.arc-shake,.arc-shake *{animation:arcShake .42s ease}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms !important;transition-duration:.01ms !important}}
`;
// Startup
buildOverlay();
injectCss();
document.addEventListener('click', onDocClick, true);
document.addEventListener('keydown', onKey);

const playEl = $('#play');
if (playEl) {
  new MutationObserver(() => {
    if (!playEl.querySelector('.arc-grid')) renderHub();
  }).observe(playEl, { childList: true });
}
document.addEventListener('hive:saved', () => renderHub());
renderHub();

if (!window.hiveArcade) {
  window.hiveArcade = {
    open: (ideaId, gameId) => openArc(ideaId ?? null, gameId ?? null),
    play: (id, ideaId) => openArc(ideaId ?? null, id)
  };
}
})();