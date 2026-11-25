/* arcade.js: Hive games, built around critical thinking.
   Replaces the Play tab games (Quest Board, Word Scramble, Recall Quiz)
   and the "Turn it into a game" menu. Mind Lab (games.js) is unchanged.
   Every game is built from the user's own idea: its words, steps and pictures. */
(() => {
  'use strict';

  const KEY = 'hive-arcade';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const say = (m, kind = 'ok', icon = '🎮') => { if (window.hiveToast) window.hiveToast(m, { kind, icon }); };
  const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rng = (seed) => { let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const adj4 = (i, n) => { const r = Math.floor(i / n), c = i % n, o = []; if (r > 0) o.push(i - n); if (r < n - 1) o.push(i + n); if (c > 0) o.push(i - 1); if (c < n - 1) o.push(i + 1); return o; };
  const tileStyle = (url, col, row, n) => `background-image:url(${url});background-size:${n * 100}% ${n * 100}%;background-position:${(col / (n - 1)) * 100}% ${(row / (n - 1)) * 100}%`;

  let store = { best: {}, plays: 0, wins: 0, xp: 0 };
  try { store = { ...store, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { /* keep defaults */ }
  const saveStore = () => localStorage.setItem(KEY, JSON.stringify(store));

  let cleanups = [], timers = [];
  const stopAll = () => { timers.forEach(clearInterval); timers = []; cleanups.forEach((f) => f()); cleanups = []; };

  const GAMES = [
    { id: 'puzzle', icon: '🧩', name: 'Picture Puzzle', skill: 'Planning moves ahead' },
    { id: 'word', icon: '🔤', name: 'Word Strategy', skill: 'Saving scarce letters' },
    { id: 'risk', icon: '♞', name: 'Risk Path', skill: 'Reading threats, like chess' },
    { id: 'maze', icon: '🌀', name: 'Maze', skill: 'Seeing the whole route' },
    { id: 'jigsaw', icon: '🧷', name: 'Jigsaw', skill: 'Matching parts to the whole' },
    { id: 'rubik', icon: '🎲', name: 'Picture Rubik', skill: 'Undoing your own moves' },
    { id: 'mappic', icon: '🗺️', name: 'Map the Picture', skill: 'Spatial memory' },
    { id: 'plan', icon: '📋', name: 'Map the Plan', skill: 'Ordering steps by logic' },
    { id: 'route', icon: '🛣️', name: 'Route Planner', skill: 'Cost over shortcuts' }
  ];

  // ---------- the idea's words, steps and pictures ----------
  const ideas = () => (window.hiveLatest && Array.isArray(window.hiveLatest.ideas) ? window.hiveLatest.ideas : []);

  function ideaText(idea) {
    const cl = idea.clarify && typeof idea.clarify === 'object' ? Object.values(idea.clarify) : [];
    const tasks = (idea.tasks || []).map((t) => t.text);
    return [idea.title, idea.body, ...cl, ...tasks].filter((x) => typeof x === 'string' && x).join(' ');
  }

  const STOP = new Set('the and for with that this from have will your what when where which into about just they them then than also more some over only very been were are was but not you our its can get make should would could there here their'.split(' '));

  function keywords(text, n = 6) {
    const c = {};
    (text.toLowerCase().match(/[a-z][a-z']{2,}/g) || []).forEach((w) => { if (!STOP.has(w)) c[w] = (c[w] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a] || a.length - b.length).slice(0, n);
  }

  const ICONS = [
    [/call|phone|talk|speak|meet/, '📞'],
    [/email|mail|message|letter|reply/, '✉️'],
    [/money|price|cost|pay|budget|sell|sale|cash|income/, '💰'],
    [/book|study|learn|read|course|exam|school|lesson/, '📚'],
    [/design|draw|sketch|art|logo|colou?r|paint/, '🎨'],
    [/build|code|app\b|website|software|develop|tech|prototype/, '🛠️'],
    [/travel|trip|visit|journey|flight|road|move/, '✈️'],
    [/food|cook|meal|eat|recipe|kitchen|bake/, '🍲'],
    [/music|song|sound|audio|voice|podcast/, '🎵'],
    [/health|gym|run|exercise|sleep|doctor|diet/, '💪'],
    [/home|house|room|family|garden/, '🏠'],
    [/plan|schedule|deadline|calendar|week|routine/, '🗓️'],
    [/team|people|friend|customer|user|client|group/, '👥'],
    [/shop|buy|store|market|product|order/, '🛒'],
    [/photo|picture|image|camera|video|film/, '📷'],
    [/write|blog|story|post|content|article|script/, '✍️'],
    [/game|play|fun|quiz|puzzle/, '🎲'],
    [/idea|think|solve|problem|question|research/, '💡']
  ];

  function iconsFor(text) {
    const t = text.toLowerCase(), out = [];
    for (const [re, e] of ICONS) if (re.test(t) && !out.includes(e)) out.push(e);
    return out;
  }

  // The idea's attached photo, if it is stored as a readable image.
  function attachedImage(idea) {
    const a = (idea.attachments || []).find((x) => /^image/.test(x.type || '') && typeof (x.data || x.url || x.src) === 'string');
    if (!a) return Promise.resolve(null);
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = a.data || a.url || a.src;
    });
  }

  // A concept picture drawn from the idea's summary: title, icons, key words and (if any) its photo.
  const PAL = [['#1e3a8a', '#ffb800'], ['#064e3b', '#fde68a'], ['#4c1d95', '#f9a8d4'], ['#7c2d12', '#fed7aa'], ['#0c4a6e', '#7dd3fc']];
  function concept(idea, variant = 0, photo = null, size = 480) {
    const text = ideaText(idea);
    const r = rng(String(idea.id || idea.title || 'idea') + ':' + variant);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const [a, b] = PAL[Math.floor(r() * PAL.length)];
    const bg = g.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, a);
    bg.addColorStop(1, '#070d1a');
    g.fillStyle = bg;
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 5; i++) {
      const x = r() * size, y = r() * size, rad = size * (0.15 + r() * 0.25);
      const rg = g.createRadialGradient(x, y, 0, x, y, rad);
      rg.addColorStop(0, b + '66');
      rg.addColorStop(1, b + '00');
      g.fillStyle = rg;
      g.fillRect(0, 0, size, size);
    }
    const pool = iconsFor(text);
    const icons = pool.length ? pool : ['✨', '💡', '🧭'];
    const keys = keywords(text, 3);
    const count = clamp(5 + icons.length * 2 + keys.length, 6, 16);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < count; i++) {
      const s = size * (0.08 + r() * 0.08);
      g.save();
      g.translate(size * (0.1 + r() * 0.8), size * (0.22 + r() * 0.56));
      g.rotate((r() - 0.5) * 0.6);
      g.font = `${s}px "Segoe UI Emoji", system-ui, sans-serif`;
      g.fillText(icons[i % icons.length], 0, 0);
      g.restore();
    }
    if (photo) {
      const k = (size * 0.42) / Math.max(photo.width, photo.height);
      const w = photo.width * k, h = photo.height * k;
      const x = (size - w) / 2, y = (size - h) / 2 + size * 0.04;
      g.fillStyle = '#fff';
      g.fillRect(x - 6, y - 6, w + 12, h + 12);
      g.drawImage(photo, x, y, w, h);
    }
    g.fillStyle = 'rgba(0,0,0,.5)';
    g.fillRect(0, 0, size, size * 0.16);
    g.fillStyle = '#fff';
    g.font = `700 ${size * 0.055}px system-ui, sans-serif`;
    g.fillText(clip(idea.title || 'My idea', 30), size / 2, size * 0.08);
    g.font = `600 ${size * 0.04}px system-ui, sans-serif`;
    let x = size * 0.04;
    const y = size * 0.92;
    keys.forEach((k) => {
      const label = clip(k, 14);
      const w = g.measureText(label).width + size * 0.04;
      g.fillStyle = 'rgba(0,0,0,.55)';
      g.fillRect(x, y - size * 0.035, w, size * 0.07);
      g.fillStyle = '#fde68a';
      g.fillText(label, x + w / 2, y);
      x += w + size * 0.02;
    });
    return c;
  }

  // ---------- shared UI ----------
  const CSS = `
.arc-ov{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(3,7,18,.72);backdrop-filter:blur(3px)}
.arc-ov[hidden]{display:none}
.arc-box{width:min(700px,100%);max-height:92vh;overflow:auto;padding:14px 16px;border-radius:18px;border:1px solid #22304a;background:#111b2e;color:#eef2ff;box-shadow:0 20px 60px rgba(0,0,0,.5);animation:arcIn .25s ease}
@keyframes arcIn{from{opacity:0;transform:translateY(12px) scale(.98)}}
.arc-top{display:flex;align-items:center;justify-content:space-between;font-size:17px;margin-bottom:6px}
.arc-x{background:none;border:0;color:#8b97b5;font-size:18px;cursor:pointer}
.arc-muted{color:#8b97b5;font-size:13px;margin:6px 0;text-align:center}
.arc-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;margin:8px 0;font-size:13px;color:#8b97b5}
.arc-btn{padding:8px 14px;border-radius:12px;border:1px solid #ffb800;background:#ffb800;color:#1a1200;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.arc-btn.ghost{background:#0b1424;color:#eef2ff;border-color:#22304a;font-weight:600}
.arc-btn:disabled{opacity:.4;cursor:default}
.arc-in{padding:9px 12px;min-width:180px;border-radius:12px;border:1px solid #22304a;background:#0b1424;color:#eef2ff;font:inherit;text-transform:uppercase}
.arc-sel{display:flex;gap:8px;align-items:center;justify-content:center;margin:8px 0;font-size:13px;color:#8b97b5}
.arc-sel select{padding:6px 8px;border-radius:10px;border:1px solid #22304a;background:#0b1424;color:#eef2ff;font:inherit}
.arc-hero h2{margin:4px 0;font-size:20px}
.arc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:10px}
.arc-card{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:12px;border-radius:14px;border:1px solid #22304a;background:#0b1424;color:#eef2ff;font:inherit;text-align:left;cursor:pointer;transition:transform .15s,border-color .15s}
.arc-card:hover{transform:translateY(-3px);border-color:#ffb800}
.arc-ico{font-size:26px}
.arc-card small{color:#8b97b5;font-size:12px}
.arc-card em{font-style:normal;color:#ffb800;font-size:12px;margin-top:4px}
.arc-msg{min-height:1.3em;margin:6px 0;text-align:center;color:#fde68a;font-size:13px}
.arc-tips{margin-top:12px;padding:10px 14px;border-radius:12px;border:1px solid #22304a;background:#0b1424;font-size:13px;text-align:left}
.arc-tips ul{margin:6px 0 0;padding-left:18px;color:#c7d0e6}
.arc-result{text-align:center}
.arc-big{font-size:46px;animation:arcPop .6s ease}
@keyframes arcPop{50%{transform:scale(1.2)}}
@keyframes arcShake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.pz-board{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:min(330px,90vw);aspect-ratio:1;margin:10px auto}
.pz-tile{padding:0;border:0;border-radius:10px;cursor:pointer;background-color:#0b1424;transition:transform .15s,filter .15s}
.pz-tile:hover{transform:scale(1.03);filter:brightness(1.1)}
.pz-gap{border-radius:10px;border:2px dashed #22304a}
.pz-peek img{display:block;width:min(300px,80vw);margin:8px auto;border-radius:12px}
.ws-rack{display:flex;gap:6px;justify-content:center;margin:12px 0}
.ws-tile{position:relative;width:44px;height:50px;display:grid;place-items:center;border-radius:10px;background:#ffb800;color:#1a1200;font-size:20px;font-weight:800;box-shadow:0 4px 0 #b57f00}
.ws-tile small{position:absolute;right:4px;bottom:2px;font-size:9px}
.ws-log{max-height:110px;overflow:auto;margin:8px 0;text-align:center;font-size:13px;color:#c7d0e6}
.rk-board{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;width:min(92vw,400px);margin:10px auto}
.rk-c{padding:0;aspect-ratio:1;display:grid;place-items:center;font-size:20px;border-radius:8px;border:1px solid #22304a;background:#0b1424;color:#eef2ff;cursor:pointer}
.rk-wall{background:#334155;cursor:default}
.rk-goal{background:#14532d}
.rk-threat{background:#4a1d24;border-color:#f87171}
.rk-move{border-color:#34d399}
.mz-board{display:grid;gap:0;width:min(92vw,420px);margin:10px auto;border:1px solid #22304a}
.mz-c{aspect-ratio:1}
.mz-w{background:#334155}
.mz-o{background:#0b1424}
.mz-t{background:#1e3a5f}
.mz-p{background:#ffb800}
.mz-g{background:#14532d}
.mz-pad{display:grid;gap:6px;justify-items:center;margin-top:8px}
.mp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:min(300px,85vw);margin:10px auto}
.mp-cell{padding:0;aspect-ratio:1;display:grid;place-items:center;font-size:30px;color:#eef2ff;border-radius:12px;border:1px solid #22304a;background:#0b1424;cursor:pointer}
.mp-cell.ok{background:#14532d;border-color:#34d399}
.mp-tray{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:8px}
.mp-ic{padding:6px 10px;font-size:24px;border-radius:12px;border:1px solid #22304a;background:#0b1424;cursor:pointer}
.mp-ic.on{border-color:#ffb800;background:#2a2108}
.mp-ic:disabled{opacity:.25;cursor:default}
.jg-board{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;width:min(300px,85vw);aspect-ratio:1;margin:10px auto}
.jg-slot{padding:0;border-radius:8px;border:2px dashed #3b4b6b;background:#0b1424;cursor:pointer}
.jg-slot.ok{border:0;cursor:default}
.jg-slot.bad{border-color:#f87171;animation:arcShake .35s}
.jg-tray{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px}
.jg-piece{width:84px;height:84px;padding:0;border-radius:10px;border:2px solid #22304a;cursor:pointer;background-color:#0b1424}
.jg-piece.on{border-color:#ffb800;transform:translateY(-4px);box-shadow:0 8px 18px rgba(0,0,0,.4)}
.rb-board{display:grid;grid-template-columns:34px repeat(3,96px) 34px;grid-template-rows:34px repeat(3,96px) 34px;gap:4px;justify-content:center;margin:12px auto}
.rb-btn{padding:0;border-radius:10px;border:1px solid #22304a;background:#0b1424;color:#ffb800;font-size:14px;cursor:pointer}
.rb-btn:hover{border-color:#ffb800}
.rb-tile{border-radius:10px;border:1px solid #22304a;background-color:#0b1424;transition:transform .25s}
.rt-board{display:grid;grid-template-columns:repeat(8,1fr);gap:3px;width:min(92vw,420px);margin:10px auto}
.rt-c{padding:0;aspect-ratio:1;display:grid;place-items:center;font-size:11px;color:#8b97b5;border-radius:6px;border:1px solid #22304a;background:#0b1424;cursor:pointer}
.rt-c:disabled{cursor:default}
.rt-wall{background:#334155}
.rt-mud{background:#3f2d18}
.rt-path{background:#1e3a5f;color:#eef2ff}
.rt-ok{border-color:#34d399}
.rt-cur{background:#ffb800;color:#1a1200;font-weight:700}
.rt-goal{background:#14532d}
.pl-bank,.pl-plan{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:10px 0}
.pl-chip{padding:9px 12px;border-radius:12px;border:1px solid #22304a;background:#0b1424;color:#eef2ff;font:inherit;font-size:13px;cursor:pointer}
.pl-chip:hover{border-color:#ffb800}
.pl-chip.bad{border-color:#f87171;animation:arcShake .35s}
.pl-got{padding:9px 12px;border-radius:12px;background:#14532d;font-size:13px}
@media (prefers-reduced-motion: reduce){.arc-box,.arc-big,.arc-card,.jg-slot.bad,.pl-chip.bad{animation:none!important;transition:none!important}}
`;

  function ensureUI() {
    if ($('#arcOv')) return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    document.body.insertAdjacentHTML('beforeend', `<div id="arcOv" class="arc-ov" hidden><div class="arc-box" role="dialog" aria-modal="true"><div class="arc-top"><b id="arcTitle"></b><button class="arc-x" id="arcX" aria-label="Close">✕</button></div><div id="arcBody"></div></div></div>`);
    $('#arcX').onclick = closeArc;
    $('#arcOv').addEventListener('click', (e) => { if (e.target.id === 'arcOv') closeArc(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#arcOv').hidden) closeArc(); });
  }

  function openArc(title, mount) {
    ensureUI();
    stopAll();
    $('#arcTitle').textContent = title;
    const body = $('#arcBody');
    body.innerHTML = '';
    body.onclick = null;
    $('#arcOv').hidden = false;
    mount(body);
  }

  function closeArc() {
    stopAll();
    const ov = $('#arcOv');
    if (ov) ov.hidden = true;
    const b = $('#arcBody');
    if (b) b.innerHTML = '';
  }

  function finish(game, idea, pct, tips) {
    const win = pct >= 60;
    const xp = win ? 15 + Math.round(pct / 5) : 4;
    store.plays++;
    if (win) store.wins++;
    store.xp += xp;
    store.best[game.id] = Math.max(store.best[game.id] || 0, pct);
    saveStore();
    stopAll();
    const body = $('#arcBody');
    body.innerHTML = `
      <div class="arc-result">
        <div class="arc-big">${win ? '🎉' : '🧠'}</div>
        <h3>${win ? 'Well thought out' : 'Good effort. Every try trains the skill.'}</h3>
        <p class="arc-muted">Score <b>${pct}%</b> · trains ${esc(game.skill.toLowerCase())} · +${xp} XP</p>
        <div class="arc-tips"><b>Pay attention to</b><ul>${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
        <div class="arc-row"><button class="arc-btn" id="arcAgain">▶ Play again</button><button class="arc-btn ghost" id="arcDone">Close</button></div>
      </div>`;
    $('#arcAgain', body).onclick = () => play(game.id, idea);
    $('#arcDone', body).onclick = closeArc;
    say(`${game.name}: ${pct}%. ${win ? 'Your thinking paid off.' : 'Try again to beat it.'}`, win ? 'done' : 'info', win ? '🎉' : '🧠');
  }

  // ---------- 1. Picture Puzzle ----------
  function gamePuzzle(body, idea, photo, done, variant = 0) {
    const N = 3, PAR = 30;
    const url = concept(idea, variant, photo, 360).toDataURL();
    let t = [0, 1, 2, 3, 4, 5, 6, 7, 8], blank = 8, moves = 0, peeks = 0;
    for (let k = 0; k < 150; k++) {
      const nb = adj4(blank, N);
      const n = nb[Math.floor(Math.random() * nb.length)];
      [t[blank], t[n]] = [t[n], t[blank]];
      blank = n;
    }
    body.innerHTML = `
      <p class="arc-muted">Slide the tiles back into the picture. Plan two or three moves ahead. Par is ${PAR} moves.</p>
      <div class="arc-row"><span>Moves <b id="pzM">0</b></span>
        <button class="arc-btn ghost" id="pzPeek">👀 Peek (−10)</button>
        <button class="arc-btn ghost" id="pzNew">🔀 New picture</button></div>
      <div class="pz-board" id="pzBoard"></div>
      <div class="pz-peek" id="pzPic" hidden><img src="${url}" alt="The whole picture"></div>`;
    const board = $('#pzBoard', body);
    const draw = () => {
      board.innerHTML = t.map((v, i) => (v === 8
        ? '<div class="pz-gap"></div>'
        : `<button class="pz-tile" data-i="${i}" aria-label="Tile" style="${tileStyle(url, v % N, Math.floor(v / N), N)}"></button>`)).join('');
      $('#pzM', body).textContent = moves;
    };
    draw();
    board.onclick = (e) => {
      const b = e.target.closest('.pz-tile');
      if (!b) return;
      const i = +b.dataset.i;
      if (!adj4(blank, N).includes(i)) return say('Move a tile that sits next to the gap.', 'info', '💭');
      [t[blank], t[i]] = [t[i], t[blank]];
      blank = i;
      moves++;
      draw();
      if (t.every((v, k) => v === k)) {
        const pct = clamp(100 - Math.max(0, moves - PAR) * 2 - peeks * 10, 20, 100);
        done(pct, [
          'Look at the whole picture first, then decide which tile to move.',
          `Every move past par (${PAR}) costs 2 points. Plan the route, then move.`,
          'Peeking costs 10 points. Use it to check your plan, not to guess.'
        ]);
      }
    };
    $('#pzPeek', body).onclick = () => {
      peeks++;
      $('#pzPic', body).hidden = false;
      say('Peeked. That costs 10 points.', 'info', '👀');
    };
    $('#pzNew', body).onclick = () => gamePuzzle(body, idea, photo, done, variant + 1);
  }

  // ---------- 2. Word Strategy ----------
  const LETTER_PTS = { a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3, n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10 };
  const LETTER_BAG = 'eeeeeeeeaaaaaaiiiiiiooooooonnnnnnrrrrrrttttttllllllssssssuuuuddddggggbbbccccmmmmppppffffhhhvvvwwwyyykjxqz';
  const VOWELS = 'aeiou';

  function gameWord(body, idea, photo, done) {
    const ROUNDS = 3, PER = 2, TARGET = 90;
    const kws = keywords(ideaText(idea), 8).filter((k) => k.length >= 4);
    let rnd = 0, wordsThisRound = 0, total = 0, rack = [], log = [], msg = '';

    const newRack = () => {
      const r = [];
      const src = kws[rnd % Math.max(1, kws.length)] || '';
      for (let i = 0; i < 2 && src; i++) r.push(src[Math.floor(Math.random() * src.length)]);
      while (r.length < 7) r.push(LETTER_BAG[Math.floor(Math.random() * LETTER_BAG.length)]);
      let v = r.filter((ch) => VOWELS.includes(ch)).length;
      for (let i = 0; i < r.length && v < 2; i++) {
        if (!VOWELS.includes(r[i])) { r[i] = VOWELS[Math.floor(Math.random() * 5)]; v++; }
      }
      return shuffle(r);
    };

    const nextRound = () => {
      rnd++;
      wordsThisRound = 0;
      if (rnd >= ROUNDS) {
        return done(clamp(Math.round(total / TARGET * 100), 0, 100), [
          "Words that use one of your idea's own words earn a bonus. Did you aim for them?",
          'Long words score more but use more of your rack. Spend tiles where they pay off.',
          'Passing a round is a choice too. Pass only when the rack is weak.'
        ]);
      }
      rack = newRack();
      msg = 'New rack.';
      log.push(`— Round ${rnd + 1} —`);
      draw();
    };

    const playWord = () => {
      const w = $('#wsIn', body).value.trim().toLowerCase();
      if (w.length < 3 || !/^[a-z]+$/.test(w)) { msg = 'Use at least 3 letters, A to Z.'; return draw(); }
      const left = rack.slice();
      for (const ch of w) {
        const k = left.indexOf(ch);
        if (k < 0) { msg = `Your rack has no "${ch.toUpperCase()}" left.`; return draw(); }
        left.splice(k, 1);
      }
      const pts = [...w].reduce((s, ch) => s + LETTER_PTS[ch], 0);
      const bonus = kws.some((k) => w.includes(k)) ? 10 : 0;
      const score = Math.round(pts * (1 + 0.25 * (w.length - 3))) + bonus;
      total += score;
      wordsThisRound++;
      rack = left;
      log.push(`${w.toUpperCase()}  +${score}${bonus ? '  (idea word bonus)' : ''}`);
      msg = `Nice. ${left.length} tiles left.`;
      if (wordsThisRound >= PER) return nextRound();
      draw();
    };

    function draw() {
      body.innerHTML = `
        <p class="arc-muted">Round ${rnd + 1} of ${ROUNDS}. Make up to ${PER} words from your rack. Words that use one of your idea's words earn a bonus. Each tile is used once.</p>
        <div class="ws-rack">${rack.map((l) => `<span class="ws-tile">${l.toUpperCase()}<small>${LETTER_PTS[l]}</small></span>`).join('')}</div>
        <div class="arc-row">
          <input id="wsIn" class="arc-in" maxlength="12" placeholder="Type a word" autocomplete="off">
          <button class="arc-btn" id="wsGo">Play word</button>
          <button class="arc-btn ghost" id="wsPass">Pass round</button>
        </div>
        <p class="arc-msg">${esc(msg)}</p>
        <div class="ws-log">${log.map((l) => `<div>${esc(l)}</div>`).join('') || '<div class="arc-muted">No words yet.</div>'}</div>
        <div class="arc-muted" style="text-align:center">Score <b>${total}</b> · target ${TARGET}</div>`;
      const inp = $('#wsIn', body);
      inp.onkeydown = (e) => { if (e.key === 'Enter') playWord(); };
      $('#wsGo', body).onclick = playWord;
      $('#wsPass', body).onclick = () => { log.push('Passed the round'); nextRound(); };
      inp.focus();
    }

    rack = newRack();
    draw();
  }

  // ---------- 3. Risk Path (chess-like: the enemy moves after every move of yours) ----------
  function gameRisk(body, idea, photo, done) {
    const N = 6, idx = (r, c) => r * N + c;
    const me0 = idx(N - 1, 0), goal = idx(0, N - 1), foe0 = idx(0, 0);
    let walls = new Set();
    const bfs = (from) => {
      const d = Array(N * N).fill(-1);
      d[from] = 0;
      const q = [from];
      while (q.length) {
        const x = q.shift();
        for (const y of adj4(x, N)) if (d[y] < 0 && !walls.has(y)) { d[y] = d[x] + 1; q.push(y); }
      }
      return d;
    };
    do {
      walls = new Set();
      while (walls.size < 6) {
        const i = Math.floor(Math.random() * N * N);
        if (i !== me0 && i !== goal && i !== foe0) walls.add(i);
      }
    } while (bfs(me0)[goal] < 0);
    const PAR = bfs(me0)[goal];
    let me = me0, foe = foe0, moves = 0, over = false;
    const TIPS = [
      'Before each move, check which red cells the enemy can reach next turn.',
      'The shortest route is not always the safest. Ask what the enemy can do after your move.',
      'Walls block the enemy too. Use them to cut off its path.'
    ];

    const finish = (won) => {
      if (won) {
        const d = bfs(me)[foe];
        const margin = d < 0 ? 6 : d;
        const pct = clamp(100 - Math.max(0, moves - PAR) * 8 + Math.min(10, margin * 2), 20, 100);
        return done(pct, [`You reached the flag in ${moves} moves. The shortest route is ${PAR}.`, ...TIPS]);
      }
      const progress = clamp(1 - bfs(me)[goal] / PAR, 0, 1);
      done(Math.round(progress * 30), ['The enemy caught you. Check its next step before you commit.', ...TIPS]);
    };

    const draw = (msg = '') => {
      const threat = new Set(adj4(foe, N).filter((j) => !walls.has(j)));
      const can = new Set(adj4(me, N).filter((j) => !walls.has(j) && j !== foe));
      let cells = '';
      for (let i = 0; i < N * N; i++) {
        let cls = 'rk-c', ic = '';
        if (walls.has(i)) cls += ' rk-wall';
        else {
          if (i === goal) { cls += ' rk-goal'; ic = '🏁'; }
          if (threat.has(i)) cls += ' rk-threat';
          if (can.has(i)) cls += ' rk-move';
        }
        if (i === me) ic = '🧑';
        if (i === foe) ic = '♟️';
        cells += `<button class="${cls}" data-i="${i}" ${walls.has(i) ? 'disabled' : ''}>${ic}</button>`;
      }
      body.innerHTML = `
        <p class="arc-muted">Reach the flag before the enemy catches you. Red cells are where the enemy can step next. Green cells are your safe steps. Every move of yours gives the enemy a turn.</p>
        <div class="arc-row"><span>Moves <b>${moves}</b> · par ${PAR}</span></div>
        <div class="rk-board">${cells}</div>
        <p class="arc-msg">${esc(msg)}</p>`;
    };

    body.onclick = (e) => {
      const b = e.target.closest('.rk-c');
      if (!b || over) return;
      const to = +b.dataset.i;
      if (!adj4(me, N).includes(to) || walls.has(to) || to === foe) return draw('Move one step to a free green cell.');
      me = to;
      moves++;
      if (me === goal) { over = true; return finish(true); }
      const dm = bfs(me);
      const cand = adj4(foe, N).filter((j) => !walls.has(j) && dm[j] >= 0);
      if (cand.length) { cand.sort((a, c) => dm[a] - dm[c]); foe = cand[0]; }
      if (foe === me) { over = true; return finish(false); }
      draw();
    };

    draw();
  }

  // ---------- 4. Maze ----------
  function gameMaze(body, idea, photo, done) {
    const C = 9, S = C * 2 + 1;
    const g = Array.from({ length: S }, () => Array(S).fill(1));
    const st = [[1, 1]];
    g[1][1] = 0;
    while (st.length) {
      const [r, c] = st[st.length - 1];
      const opts = [[0, 2], [0, -2], [2, 0], [-2, 0]]
        .map(([dr, dc]) => [r + dr, c + dc, dr / 2, dc / 2])
        .filter(([nr, nc]) => nr > 0 && nr < S - 1 && nc > 0 && nc < S - 1 && g[nr][nc] === 1);
      if (!opts.length) { st.pop(); continue; }
      const [nr, nc, mr, mc] = opts[Math.floor(Math.random() * opts.length)];
      g[r + mr][c + mc] = 0;
      g[nr][nc] = 0;
      st.push([nr, nc]);
    }
    const GOAL = [S - 2, S - 2];
    const par = (() => {
      const d = Array.from({ length: S }, () => Array(S).fill(-1));
      d[1][1] = 0;
      const q = [[1, 1]];
      while (q.length) {
        const [r, c] = q.shift();
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const nr = r + dr, nc = c + dc;
          if (g[nr][nc] === 0 && d[nr][nc] < 0) { d[nr][nc] = d[r][c] + 1; q.push([nr, nc]); }
        }
      }
      return d[GOAL[0]][GOAL[1]];
    })();

    let pr = 1, pc = 1, steps = 0, bumps = 0;
    const trail = new Set(['1,1']);

    const finish = () => {
      const pct = clamp(Math.round(par / steps * 100), 10, 100);
      done(pct, [
        `You took ${steps} steps. The shortest route is ${par}.`,
        `You bumped into walls ${bumps} time(s). Read the map before moving.`,
        'Dead ends look open from the entrance. Check one step further before you commit.'
      ]);
    };

    const draw = (msg = '') => {
      let cells = '';
      for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) {
        let cls = 'mz-c ';
        if (g[r][c]) cls += 'mz-w';
        else if (r === pr && c === pc) cls += 'mz-p';
        else if (r === GOAL[0] && c === GOAL[1]) cls += 'mz-g';
        else if (trail.has(r + ',' + c)) cls += 'mz-t';
        else cls += 'mz-o';
        cells += `<div class="${cls}"></div>`;
      }
      body.innerHTML = `
        <p class="arc-muted">Find the way to the green exit. Every step into a dead end costs you. Use the arrow keys, WASD, or the buttons.</p>
        <div class="arc-row"><span>Steps <b>${steps}</b> · best possible ${par}</span></div>
        <div class="mz-board" style="grid-template-columns:repeat(${S},1fr)">${cells}</div>
        <div class="mz-pad">
          <div><button class="arc-btn ghost" data-mv="-1,0">▲</button></div>
          <div><button class="arc-btn ghost" data-mv="0,-1">◀</button> <button class="arc-btn ghost" data-mv="1,0">▼</button> <button class="arc-btn ghost" data-mv="0,1">▶</button></div>
        </div>
        <p class="arc-msg">${esc(msg)}</p>`;
    };

    const move = (dr, dc) => {
      const nr = pr + dr, nc = pc + dc;
      if (g[nr][nc]) { bumps++; return draw('Wall. Look for the open path.'); }
      pr = nr; pc = nc; steps++;
      trail.add(nr + ',' + nc);
      if (nr === GOAL[0] && nc === GOAL[1]) return finish();
      draw();
    };

    const KEYMAP = { ArrowUp: [-1, 0], w: [-1, 0], W: [-1, 0], ArrowDown: [1, 0], s: [1, 0], S: [1, 0], ArrowLeft: [0, -1], a: [0, -1], A: [0, -1], ArrowRight: [0, 1], d: [0, 1], D: [0, 1] };
    const onKey = (e) => { const m = KEYMAP[e.key]; if (!m) return; e.preventDefault(); move(m[0], m[1]); };
    document.addEventListener('keydown', onKey);
    cleanups.push(() => document.removeEventListener('keydown', onKey));

    body.onclick = (e) => {
      const b = e.target.closest('[data-mv]');
      if (!b) return;
      const [dr, dc] = b.dataset.mv.split(',').map(Number);
      move(dr, dc);
    };

    draw();
  }

  // ---------- 5. Jigsaw ----------
  function gameJigsaw(body, idea, photo, done, variant = 0) {
    const N = 3;
    const url = concept(idea, variant, photo, 360).toDataURL();
    const order = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const placed = new Set();
    let sel = null, mistakes = 0;

    body.innerHTML = `
      <p class="arc-muted">Tap a piece below, then tap the empty slot where it belongs. A wrong slot costs 6 points. Look at edges and colours.</p>
      <div class="arc-row"><span>Mistakes <b id="jsM">0</b></span><button class="arc-btn ghost" id="jsNew">🔀 New picture</button></div>
      <div class="jg-board">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<button class="jg-slot" data-s="${i}" aria-label="Slot ${i + 1}"></button>`).join('')}</div>
      <div class="jg-tray">${order.map((p) => `<button class="jg-piece" data-p="${p}" style="${tileStyle(url, p % N, Math.floor(p / N), N)}" aria-label="Piece"></button>`).join('')}</div>`;

    body.onclick = (e) => {
      const pc = e.target.closest('.jg-piece');
      if (pc) {
        sel = +pc.dataset.p;
        body.querySelectorAll('.jg-piece').forEach((b) => b.classList.toggle('on', b === pc));
        return;
      }
      const sl = e.target.closest('.jg-slot');
      if (!sl || sel === null) return;
      const s = +sl.dataset.s;
      if (placed.has(s)) return;
      if (sel === s) {
        placed.add(s);
        sl.classList.add('ok');
        sl.style.cssText = tileStyle(url, s % N, Math.floor(s / N), N);
        body.querySelector(`.jg-piece[data-p="${s}"]`)?.remove();
        sel = null;
        if (placed.size === 9) {
          return done(clamp(100 - mistakes * 6, 20, 100), [
            `You placed all nine pieces with ${mistakes} wrong slot(s).`,
            'Before tapping, check a piece\'s edges against its neighbours.',
            'Large areas of one colour usually sit together. Start with them.'
          ]);
        }
      } else {
        mistakes++;
        $('#jsM', body).textContent = mistakes;
        sl.classList.add('bad');
        setTimeout(() => sl.classList.remove('bad'), 380);
        sel = null;
        body.querySelectorAll('.jg-piece.on').forEach((b) => b.classList.remove('on'));
      }
    };

    $('#jsNew', body).onclick = () => gameJigsaw(body, idea, photo, done, variant + 1);
  }

  // ---------- 6. Picture Rubik ----------
  function gameRubik(body, idea, photo, done, variant = 0) {
    const N = 3, PAR = 14;
    const url = concept(idea, variant, photo, 360).toDataURL();
    let t = [0, 1, 2, 3, 4, 5, 6, 7, 8], moves = 0, wasted = 0, lastMove = null;

    // Turns a whole row (op 'r') or column (op 'c'). d = +1 moves right/down, -1 left/up.
    const rot = (op, k, d) => {
      const ids = [];
      for (let j = 0; j < N; j++) ids.push(op === 'r' ? k * N + j : j * N + k);
      const vals = ids.map((i) => t[i]);
      ids.forEach((i, j) => { t[i] = vals[(j - d + N) % N]; });
    };

    let prev = null;
    for (let s = 0; s < PAR; s++) {
      let op, k, d;
      do {
        op = Math.random() < 0.5 ? 'r' : 'c';
        k = Math.floor(Math.random() * N);
        d = Math.random() < 0.5 ? -1 : 1;
      } while (prev && prev.op === op && prev.k === k && prev.d === -d);
      rot(op, k, d);
      prev = { op, k, d };
    }
    if (t.every((v, i) => v === i)) rot('r', 0, 1);

    const draw = (msg = '') => {
      let h = '';
      for (let k = 0; k < N; k++) {
        h += `<button class="rb-btn" data-op="c" data-k="${k}" data-d="-1" style="grid-row:1;grid-column:${k + 2}" aria-label="Move column up">▲</button>`;
        h += `<button class="rb-btn" data-op="c" data-k="${k}" data-d="1" style="grid-row:5;grid-column:${k + 2}" aria-label="Move column down">▼</button>`;
        h += `<button class="rb-btn" data-op="r" data-k="${k}" data-d="-1" style="grid-row:${k + 2};grid-column:1" aria-label="Move row left">◀</button>`;
        h += `<button class="rb-btn" data-op="r" data-k="${k}" data-d="1" style="grid-row:${k + 2};grid-column:5" aria-label="Move row right">▶</button>`;
      }
      for (let i = 0; i < 9; i++) {
        h += `<div class="rb-tile" style="grid-row:${Math.floor(i / N) + 2};grid-column:${(i % N) + 2};${tileStyle(url, t[i] % N, Math.floor(t[i] / N), N)}"></div>`;
      }
      body.innerHTML = `
        <p class="arc-muted">The picture is mixed up. Each arrow slides a whole row or column, like a Rubik's cube. Put every piece back. Par is ${PAR} moves.</p>
        <div class="arc-row"><span>Moves <b>${moves}</b> · wasted <b>${wasted}</b></span></div>
        <div class="rb-board">${h}</div>
        <p class="arc-msg">${esc(msg)}</p>`;
    };

    body.onclick = (e) => {
      const b = e.target.closest('.rb-btn');
      if (!b) return;
      const op = b.dataset.op, k = +b.dataset.k, d = +b.dataset.d;
      if (lastMove && lastMove.op === op && lastMove.k === k && lastMove.d === -d) wasted++;
      rot(op, k, d);
      moves++;
      lastMove = { op, k, d };
      if (t.every((v, i) => v === i)) {
        return done(clamp(100 - Math.max(0, moves - PAR) * 3 - wasted * 5, 20, 100), [
          `You solved it in ${moves} moves. Par is ${PAR}.`,
          `${wasted} move(s) undid your previous move. Each one wasted a turn.`,
          'Fix one piece at a time without pulling a finished row or column out of place.'
        ]);
      }
      draw();
    };

    draw();
  }

  // ---------- 7. Map the Picture (spatial memory) ----------
  function gameMapPic(body, idea, photo, done) {
    const FILL = ['⭐', '🔺', '🌙', '🔶', '🌿', '❄️', '🔷', '🎈', '⚡', '🍀'];
    const icons = [...new Set([...iconsFor(ideaText(idea)), ...FILL])].slice(0, 9);
    const layout = shuffle(icons.slice());
    let placed = Array(9).fill(null), sel = null, mistakes = 0, looks = 0, phase = 'look', ticker = null;

    body.innerHTML = `
      <p class="arc-muted">Study where each symbol sits and what sits next to it. Then rebuild the map from memory.</p>
      <div class="mp-grid" id="mpG"></div>
      <div id="mpBar" class="arc-row"></div>`;
    const gridEl = $('#mpG', body), bar = $('#mpBar', body);

    const draw = () => {
      const used = new Set(placed.filter(Boolean));
      gridEl.innerHTML = placed.map((p, i) => `<button class="mp-cell ${p ? 'ok' : ''}" data-c="${i}">${p || i + 1}</button>`).join('');
      bar.innerHTML = `<div class="mp-tray">${icons.map((ic) => `<button class="mp-ic ${ic === sel ? 'on' : ''}" data-ic="${ic}" ${used.has(ic) ? 'disabled' : ''}>${ic}</button>`).join('')}</div>
        <div class="arc-row"><span>Placed ${used.size}/9 · mistakes ${mistakes}</span><button class="arc-btn ghost" id="mpLook">👀 Look again (−10)</button></div>`;
    };

    const build = () => { phase = 'build'; draw(); };

    const look = (secs) => {
      phase = 'look';
      placed = Array(9).fill(null);
      sel = null;
      clearInterval(ticker);
      let s = secs;
      const paint = () => {
        gridEl.innerHTML = layout.map((ic) => `<div class="mp-cell">${ic}</div>`).join('');
        bar.innerHTML = `<span>Memorise it · <b>${s}</b>s</span>`;
      };
      paint();
      ticker = setInterval(() => {
        s--;
        if (s <= 0) { clearInterval(ticker); return build(); }
        paint();
      }, 1000);
      timers.push(ticker);
    };

    body.onclick = (e) => {
      if (phase !== 'build') return;
      if (e.target.closest('#mpLook')) { looks++; return look(6); }
      const ic = e.target.closest('[data-ic]');
      if (ic && !ic.disabled) { sel = ic.dataset.ic; return draw(); }
      const c = e.target.closest('[data-c]');
      if (!c || !sel) return;
      const i = +c.dataset.c;
      if (placed[i]) return;
      if (layout[i] === sel) {
        placed[i] = sel;
        sel = null;
        if (placed.every(Boolean)) {
          clearInterval(ticker);
          return done(clamp(100 - mistakes * 8 - looks * 10, 0, 100), [
            `You rebuilt all nine symbols. Wrong tries: ${mistakes}. Looks: ${looks}.`,
            'Remember neighbours, not single spots. "The star sits next to the moon" is easier to keep.',
            'Each wrong try costs 8 points. Place a symbol only when you are sure.'
          ]);
        }
      } else {
        mistakes++;
        sel = null;
        say('Not there. Look at what sits next to that spot.', 'info', '💭');
      }
      draw();
    };

    look(8);
  }

  // ---------- 8. Map the Plan (ordering by logic) ----------
  const WHY = [
    'A clear finish line comes first, or everything else drifts.',
    'Gathering comes before doing, so nothing stops you halfway.',
    'A small first step builds momentum and shows what is really needed.',
    'Testing comes before sharing, so problems show up while they are cheap.',
    'Fixing comes after testing, once you know what broke.',
    'Sharing comes last, once the result is solid.'
  ];

  function gamePlan(body, idea, photo, done) {
    const timed = (idea.tasks || []).filter((t) => t.text && t.scheduled)
      .sort((a, b) => new Date(a.scheduled) - new Date(b.scheduled));
    const own = timed.length >= 4;
    const steps = own
      ? timed.slice(0, 6).map((t) => t.text)
      : ['Clear what "done" looks like', 'Gather what you need', 'Do the first small step', 'Test it with one real person', 'Fix what broke', 'Share the result'];
    const bank = shuffle(steps.map((_, i) => i));
    let next = 0, mistakes = 0;

    const draw = () => {
      body.innerHTML = `
        <p class="arc-muted">${own
          ? 'These are your own steps, in the order you scheduled them. Tap them in the order they should happen.'
          : 'Tap the steps in the order a sound plan needs them. Ask what each step depends on.'}</p>
        <div class="pl-bank">${bank.map((i) => `<button class="pl-chip" data-p="${i}">${esc(clip(steps[i], 40))}</button>`).join('')}</div>
        <div class="arc-row"><span>Your plan</span></div>
        <div class="pl-plan">${steps.slice(0, next).map((s, i) => `<span class="pl-got">${i + 1}. ${esc(clip(s, 40))}</span>`).join('') || '<span class="arc-muted">Nothing yet.</span>'}</div>
        <div class="arc-row">Mistakes <b>${mistakes}</b> · 15 points each</div>`;
    };

    body.onclick = (e) => {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      const i = +b.dataset.p;
      if (i !== next) {
        mistakes++;
        say('Not yet. What does that step need first?', 'info', '💭');
        draw();
        const again = body.querySelector(`[data-p="${i}"]`);
        if (again) again.classList.add('bad');
        return;
      }
      bank.splice(bank.indexOf(i), 1);
      next++;
      if (next === steps.length) {
        const tips = steps.map((s, k) => `${k + 1}. ${clip(s, 40)}: ${own ? 'this was scheduled in this position.' : WHY[k] || 'keeps the plan moving.'}`);
        return done(clamp(100 - mistakes * 15, 20, 100), tips);
      }
      draw();
    };

    draw();
  }

  // ---------- 9. Route Planner (weighted cost, obstacles) ----------
  function gameRoute(body, idea, photo, done) {
    const N = 8, START = 0, GOAL = N * N - 1;
    let cost = [];

    const dijkstra = (from) => {
      const d = Array(N * N).fill(Infinity), seen = Array(N * N).fill(false);
      d[from] = 0;
      for (;;) {
        let u = -1;
        for (let i = 0; i < N * N; i++) if (!seen[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
        if (u < 0) break;
        seen[u] = true;
        for (const v of adj4(u, N)) if (cost[v] > 0 && d[u] + cost[v] < d[v]) d[v] = d[u] + cost[v];
      }
      return d;
    };

    do {
      cost = Array.from({ length: N * N }, (_, i) => {
        if (i === START || i === GOAL) return 1;
        const r = Math.random();
        return r < 0.18 ? -1 : r < 0.4 ? 3 : 1;
      });
    } while (dijkstra(START)[GOAL] === Infinity);
    const best = dijkstra(START)[GOAL];

    const path = [START], visited = new Set([START]);
    let spent = 0;

    const draw = (msg = '') => {
      const cur = path[path.length - 1];
      const open = new Set(adj4(cur, N).filter((j) => cost[j] > 0 && !visited.has(j)));
      const stuck = !open.size && cur !== GOAL;
      let cells = '';
      for (let i = 0; i < N * N; i++) {
        let cls = 'rt-c', lab = cost[i] > 0 ? String(cost[i]) : '';
        if (cost[i] < 0) cls += ' rt-wall';
        else {
          if (cost[i] === 3) cls += ' rt-mud';
          if (visited.has(i)) cls += ' rt-path';
          if (open.has(i)) cls += ' rt-ok';
          if (i === GOAL) { cls += ' rt-goal'; lab = '🏁'; }
        }
        if (i === cur) { cls += ' rt-cur'; lab = '🚶'; }
        const off = cost[i] < 0 || (visited.has(i) && i !== cur);
        cells += `<button class="${cls}" data-i="${i}" ${off ? 'disabled' : ''}>${lab}</button>`;
      }
      body.innerHTML = `
        <p class="arc-muted">Plan a route from the top-left to the flag. Each step costs the number on the cell you enter. Mud costs 3. A longer route on clear ground can cost less. Undo is free.</p>
        <div class="arc-row"><span>Cost <b>${spent}</b></span><button class="arc-btn ghost" id="rtUndo" ${path.length < 2 ? 'disabled' : ''}>↶ Undo step</button></div>
        <div class="rt-board">${cells}</div>
        <p class="arc-msg">${esc(stuck && !msg ? 'Dead end. Undo a step.' : msg)}</p>`;
    };

    body.onclick = (e) => {
      if (e.target.closest('#rtUndo')) {
        if (path.length < 2) return;
        const last = path.pop();
        visited.delete(last);
        spent -= cost[last];
        return draw('Stepped back.');
      }
      const b = e.target.closest('.rt-c');
      if (!b || b.disabled) return;
      const to = +b.dataset.i;
      const cur = path[path.length - 1];
      if (!adj4(cur, N).includes(to) || cost[to] < 0 || visited.has(to)) return draw('Step to a free neighbouring cell.');
      path.push(to);
      visited.add(to);
      spent += cost[to];
      if (to === GOAL) {
        const pct = clamp(Math.round(best / spent * 100), 10, 100);
        return done(pct, [
          `Your route cost ${spent}. The cheapest possible is ${best}.`,
          'Mud costs 3 per step. Two plain steps can beat one muddy shortcut.',
          'Undo is free. Use it when a route looks costly, instead of pushing on.'
        ]);
      }
      draw();
    };

    draw();
  }

  // ---------- picking and launching ----------
  const MOUNT = { puzzle: gamePuzzle, word: gameWord, risk: gameRisk, maze: gameMaze, jigsaw: gameJigsaw, rubik: gameRubik, mappic: gameMapPic, plan: gamePlan, route: gameRoute };

  function play(id, idea) {
    const game = GAMES.find((g) => g.id === id);
    if (!game) return;
    if (!idea) return say('Save an idea first. Games are built from your own ideas.', 'info', '💡');
    attachedImage(idea).then((photo) => {
      openArc(`${game.icon} ${game.name}`, (body) => MOUNT[id](body, idea, photo, (pct, tips) => finish(game, idea, pct, tips)));
    });
  }

  function ideaSelect() {
    const list = ideas();
    if (!list.length) return '<p class="arc-muted">Save an idea first. Games are built from your own words, steps and pictures.</p>';
    const open = visible($('#ideaOverlay')) && $('#eTitle') ? $('#eTitle').value : '';
    const cur = list.find((i) => i.title === open) || list[0];
    return `<label class="arc-sel">Idea <select id="arcIdeaSel">${list.map((i) => `<option value="${esc(i.id)}"${i.id === cur.id ? ' selected' : ''}>${esc(i.title || 'Untitled')}</option>`).join('')}</select></label>`;
  }

  function cardsHTML() {
    return `<div class="arc-grid">${GAMES.map((g) => `<button class="arc-card" data-arc-play="${g.id}"><span class="arc-ico">${g.icon}</span><b>${g.name}</b><small>${g.skill}</small><em>Best ${store.best[g.id] != null ? store.best[g.id] + '%' : '–'}</em></button>`).join('')}</div>`;
  }

  function openPicker() {
    if (!ideas().length) return say('Save an idea first. Games are built from your own ideas.', 'info', '💡');
    openArc('🎮 Turn it into a game', (body) => {
      body.innerHTML = `<p class="arc-muted">Pick a game. It is built from this idea's own words, steps and pictures.</p>${ideaSelect()}${cardsHTML()}`;
    });
  }

  function renderHub(host) {
    host.innerHTML = `
      <section id="arcHub" class="arc-hub">
        <div class="arc-hero"><h2>🎮 Games that make you think</h2>
        <p class="arc-muted">Each game trains one thinking skill. Good decisions score higher than quick taps. Games are built from your own ideas.</p></div>
        ${ideaSelect()}${cardsHTML()}
      </section>`;
  }

  // The Play tab always shows the new hub, even when older code redraws it.
  function watchPlay() {
    const host = document.getElementById('play');
    if (!host) return;
    const fix = () => { if (!host.querySelector('#arcHub')) renderHub(host); };
    new MutationObserver(fix).observe(host, { childList: true });
    fix();
  }

  // Capture phase: game cards start a game; the old "Turn it into a game" entries open the new picker.
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    const card = t.closest('[data-arc-play]');
    if (card) {
      const sel = $('#arcIdeaSel');
      const idea = ideas().find((i) => i.id === (sel ? sel.value : '')) || ideas()[0];
      return play(card.dataset.arcPlay, idea);
    }
    const btn = t.closest('button, [data-play]');
    if (btn && (btn.hasAttribute('data-play') || /turn it into a game/i.test(btn.textContent))) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openPicker();
    }
  }, true);

  window.hiveArcade = { open: openPicker, play };

  function init() {
    ensureUI();
    watchPlay();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();