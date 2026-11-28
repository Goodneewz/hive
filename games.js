/* games.js — Hive Mind Lab
   A critical-thinking puzzle system built from your own idea.
   Reads ideas from window.hiveLatest (set by index.html).
   Stores its own progress in localStorage key "hive-lab". */
(() => {
  'use strict';

  const KEY = 'hive-lab';
  const ROUND_SIZE = 5;
  const WIN_AT = 0.6;
  const STOP = new Set(('the and for with that this from about have will into your need want make just like some more very ' +
    'when what then than also only been they them there here their would could should which while where being over ' +
    'because each every other such does doing done goes going come came take took give gave onto upon yours ours our out ' +
    'off all any can not are was were its it is in on at to of a an be by or as if so do my me we he she his her you').split(' '));
  const GENERIC = ['focus', 'progress', 'habit', 'deadline', 'routine', 'clarity', 'momentum', 'outcome'];
  const SKIP_KEYS = new Set(['id', 'src', 'image', 'audio', 'status', 'category', 'created', 'updated',
    'createdAt', 'updatedAt', 'scheduled', 'tags', 'color', 'uid']);
  const ICONS = [
    [/study|learn|exam|course|school|lecture|class|read/, '📚'],
    [/money|pay|budget|sell|price|cash|income|client|invoice|business|market|startup/, '💰'],
    [/build|code|app|develop|program|software|website|prototype|tool/, '🛠️'],
    [/write|draft|essay|article|blog|story|script|post/, '✍️'],
    [/time|schedule|deadline|calendar|week|daily|routine|morning|plan/, '⏰'],
    [/health|gym|run|sleep|diet|workout|water|fitness|rest/, '💪'],
    [/music|song|sound|audio|voice|podcast/, '🎵'],
    [/art|draw|paint|sketch|photo|video|film|picture|image|design/, '🎨'],
    [/food|cook|recipe|meal|eat/, '🍲'],
    [/friend|team|people|family|partner|share|meet|call/, '🤝'],
    [/travel|trip|move|city|country/, '✈️'],
    [/home|house|room|clean|garden/, '🏠'],
    [/research|data|analy|test|experiment|science/, '🔬'],
  ];
  const SKILL = {
    recall: {
      label: 'Recall',
      strong: 'You connect concepts to what they mean.',
      tip: 'Before reading the options, say the concept in your own words. Then find the option that means the same thing.',
    },
    reasoning: {
      label: 'Context reasoning',
      strong: 'You use the sentence around a gap to decide.',
      tip: 'Read the words before and after the gap. Ask which option keeps the whole sentence true for this idea, not just which one sounds familiar.',
    },
    sequence: {
      label: 'Sequencing',
      strong: 'You order steps by what must come first.',
      tip: 'Work backwards. Find the step that needs the others done first, then place the earlier steps before it. Check each pair you are unsure about.',
    },
  };
  const SKILL_OF = { picture: 'recall', gap: 'reasoning', sequence: 'sequence' };
  const BADGES = {
    first: '🌱 First Round',
    victory: '🏆 First Victory',
    sharp: '🎯 Sharp Mind (perfect round)',
    comeback: '🔁 Comeback (won after a loss)',
    steady: '🧱 Steady (5 rounds)',
  };

  /* ---------- storage ---------- */
  const blank = () => ({
    xp: 0, rounds: 0, wins: 0,
    skills: { recall: [0, 0], reasoning: [0, 0], sequence: [0, 0] },
    badges: [], history: [],
  });
  function load() {
    try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch (e) { return blank(); }
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage full or blocked */ }
  }

  /* ---------- helpers ---------- */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const rx = w => new RegExp('\\b' + w + '\\b', 'i');
  const wordsOf = s => (s.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []);
  function hue(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Draws a picture card for a concept (SVG, no network, no key).
  function tile(word) {
    const hit = ICONS.find(([re]) => re.test(word));
    const icon = hit ? hit[1] : '🔹';
    const h = hue(word);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + h + ',70%,38%)"/>' +
      '<stop offset="1" stop-color="hsl(' + ((h + 40) % 360) + ',80%,22%)"/></linearGradient></defs>' +
      '<rect width="240" height="180" rx="22" fill="url(#g)"/>' +
      '<circle cx="200" cy="30" r="40" fill="rgba(255,255,255,0.08)"/>' +
      '<text x="120" y="98" font-size="58" text-anchor="middle" font-family="Segoe UI Emoji, Apple Color Emoji, sans-serif">' + icon + '</text>' +
      '<text x="120" y="152" font-size="22" font-weight="700" text-anchor="middle" fill="#FFF3C4" font-family="Arial, sans-serif">' + esc(word) + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function h(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n[k] = v;
      else n.setAttribute(k, v);
    }
    kids.flat().forEach(c => {
      if (c == null || c === false) return;
      n.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return n;
  }

  /* ---------- reading ideas ---------- */
  function ideaList() {
    const s = window.hiveLatest;
    if (!s) return [];
    if (Array.isArray(s.ideas)) return s.ideas;
    const found = Object.values(s).find(v => Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && 'title' in v[0]);
    return found || [];
  }
  function collectStrings(obj, out = [], depth = 0) {
    if (obj == null || depth > 6) return out;
    if (typeof obj === 'string') { out.push(obj); return out; }
    if (Array.isArray(obj)) { obj.forEach(v => collectStrings(v, out, depth + 1)); return out; }
    if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        if (SKIP_KEYS.has(k)) continue;
        collectStrings(v, out, depth + 1);
      }
    }
    return out;
  }
  function analyze(idea) {
    const all = collectStrings(idea);
    const images = all.filter(s => s.startsWith('data:image'));
    const texts = all.filter(s => s.trim().length > 1 && !s.startsWith('data:'));
    const joined = texts.join(' . ');
    const sentences = joined.split(/[.!?\n]+/)
      .map(s => s.trim())
      .filter(s => s.split(/\s+/).length >= 3)
      .slice(0, 12);
    const freq = {};
    wordsOf(joined).forEach(w => { if (!STOP.has(w)) freq[w] = (freq[w] || 0) + 1; });
    const concepts = Object.entries(freq)
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .slice(0, 8)
      .map(e => e[0]);
    const steps = (Array.isArray(idea.tasks) ? idea.tasks : [])
      .map(t => typeof t === 'string' ? t : String((t && (t.text || t.title || t.name)) || ''))
      .filter(Boolean);
    const title = String(idea.title || texts[0] || 'Untitled idea');
    return { title, images, sentences, concepts, steps };
  }

  /* ---------- question makers ---------- */
  function decoys(exclude, n, A) {
    const pool = [...new Set([...A.concepts, ...GENERIC])].filter(w => !exclude.includes(w));
    return shuffle(pool).slice(0, n);
  }
  function gapQ(A) {
    const usable = A.sentences.filter(s => A.concepts.some(c => rx(c).test(s)));
    if (!usable.length) return null;
    const sentence = shuffle(usable)[0];
    const inS = A.concepts.filter(c => rx(c).test(sentence));
    const answer = shuffle(inS)[0];
    const sentWords = wordsOf(sentence);
    return {
      type: 'gap',
      prompt: 'Fill the gap. Use the rest of the sentence, not just the word that sounds right.',
      body: sentence.replace(rx(answer), '_____'),
      options: shuffle([answer, ...decoys(sentWords, 3, A)]),
      answer,
      why: '"' + answer + '" is the word this sentence depends on. The other choices are real parts of your idea, but they do not make this sentence true.',
    };
  }
  function pictureQ(A) {
    if (A.concepts.length < 4) return null;
    const answer = shuffle(A.concepts)[0];
    return {
      type: 'picture',
      prompt: 'Look at the picture. Which concept from your idea does it stand for?',
      image: tile(answer),
      options: shuffle([answer, ...decoys([answer], 3, A)]),
      answer,
      why: 'The picture is built from a concept in your idea. The icon shows the kind of thing it is; the label names the exact concept. Recall the label first, then check the icon agrees.',
    };
  }
  function sequenceQ(A) {
    if (A.steps.length < 3) return null;
    const items = A.steps.slice(0, 4).map((t, i) => ({ i, t }));
    let shuffled = shuffle(items);
    for (let k = 0; k < 5 && items.length > 1 && shuffled.every((x, i) => x.i === i); k++) shuffled = shuffle(items);
    return {
      type: 'sequence',
      prompt: 'Put these steps in the order they should happen. Tap a step to place it. Tap a placed step to return it.',
      items,
      shuffled,
      why: 'Each step should come after whatever it depends on. Your written plan is the reference order.',
    };
  }
  function buildRound(A) {
    const makers = [gapQ, pictureQ, sequenceQ];
    const qs = [];
    for (let t = 0; t < 30 && qs.length < ROUND_SIZE; t++) {
      const q = makers[t % 3](A);
      if (q) qs.push(q);
    }
    return qs;
  }
  // Fraction of step pairs placed in the reference order (1 = perfect).
  function seqScore(order, n) {
    const pos = [];
    order.forEach((idx, p) => { pos[idx] = p; });
    let ok = 0, total = 0;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      total++;
      if (pos[a] < pos[b]) ok++;
    }
    return total ? ok / total : 0;
  }

  /* ---------- UI ---------- */
  let ov, panel, S = null;

  function injectCSS() {
    const css = `
.ml-fab{position:fixed;left:14px;bottom:14px;z-index:900;border:0;border-radius:999px;padding:12px 16px;font-weight:700;color:#050F1E;background:linear-gradient(135deg,#FFB800,#FFD84D);box-shadow:0 8px 24px rgba(255,184,0,.35);cursor:pointer;animation:ml-pulse 2.4s ease-in-out infinite}
.ml-ov{position:fixed;inset:0;z-index:1000;background:rgba(3,8,16,.78);display:none;align-items:flex-start;justify-content:center;padding:16px;overflow:auto}
.ml-ov.open{display:flex}
.ml-panel{width:min(620px,100%);margin:auto 0}
.ml-card{background:#0B1A2E;color:#F4EFD8;border:1px solid rgba(255,184,0,.25);border-radius:18px;padding:18px;animation:ml-in .35s ease}
.ml-head{display:flex;justify-content:space-between;align-items:center}
.ml-head h2{margin:0;font-size:1.25rem}
.ml-x{background:none;border:0;color:#F4EFD8;font-size:1.2rem;cursor:pointer}
.ml-muted{opacity:.7;font-size:.92rem}
.ml-stats{display:flex;gap:10px;margin:10px 0}
.ml-stat{flex:1;background:rgba(255,184,0,.1);border-radius:12px;padding:10px;text-align:center}
.ml-stat b{display:block;font-size:1.3rem;color:#FFB800}
.ml-idea{display:flex;flex-direction:column;align-items:flex-start;width:100%;margin:6px 0;padding:12px;border-radius:12px;border:1px solid rgba(255,184,0,.2);background:#11263F;color:inherit;text-align:left;cursor:pointer;transition:transform .15s}
.ml-idea:hover{transform:translateY(-2px);border-color:#FFB800}
.ml-row{display:flex;justify-content:space-between;font-size:.9rem}
.ml-bar{height:8px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden;margin:4px 0 10px}
.ml-fill{height:100%;background:linear-gradient(90deg,#FFB800,#FF7A59);transition:width .6s ease}
.ml-board{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0}
.ml-tile{width:150px;border-radius:14px;box-shadow:0 6px 18px rgba(0,0,0,.35);animation:ml-in .5s ease both}
.ml-pic{width:100%;max-width:300px;display:block;margin:10px auto;border-radius:16px}
.ml-prompt{font-size:1.05rem;margin:10px 0}
.ml-body{font-size:1.15rem;background:rgba(255,255,255,.05);padding:12px;border-radius:12px;line-height:1.5}
.ml-opt,.ml-chip{display:block;width:100%;margin:6px 0;padding:12px;border-radius:12px;border:1px solid rgba(255,184,0,.3);background:#11263F;color:inherit;font-size:1rem;cursor:pointer;text-align:left;transition:transform .12s,background .2s}
.ml-opt:hover:not(:disabled),.ml-chip:hover{transform:translateX(4px);background:#183456}
.ml-opt:disabled{cursor:default}
.ml-opt.right{background:#1F6B3A;border-color:#4ADE80}
.ml-opt.wrong{background:#6B1F2A;border-color:#F87171;animation:ml-shake .4s}
.ml-chip{display:inline-block;width:auto;margin:4px}
.ml-chip.placed{background:#2A2208}
.ml-bank,.ml-placed{min-height:44px;margin:4px 0 10px}
.ml-label{font-size:.8rem;opacity:.7;text-transform:uppercase;letter-spacing:.08em;margin-top:8px}
.ml-btn{margin-top:12px;padding:12px 18px;border:0;border-radius:12px;background:#FFB800;color:#050F1E;font-weight:800;cursor:pointer}
.ml-ghost{margin-top:12px;margin-left:8px;padding:10px 14px;border-radius:12px;background:none;color:#F4EFD8;border:1px solid rgba(255,255,255,.2);cursor:pointer}
.ml-fb{margin-top:12px;padding:12px;border-radius:12px;animation:ml-in .3s ease}
.ml-fb.ok{background:rgba(74,222,128,.15)}
.ml-fb.part{background:rgba(255,184,0,.15)}
.ml-fb.bad{background:rgba(248,113,113,.15)}
.ml-gain{font-weight:700;color:#FFB800;margin-left:6px}
.ml-remark{padding:10px;border-radius:12px;margin:8px 0;background:rgba(255,255,255,.05)}
.ml-remark.good{border-left:4px solid #4ADE80}
.ml-remark.todo{border-left:4px solid #FFB800}
.ml-reward{font-size:1.2rem;font-weight:800;color:#FFB800;margin:10px 0}
.ml-badge{display:inline-block;margin:4px;padding:6px 10px;border-radius:999px;background:rgba(255,184,0,.15)}
.ml-sum{margin:6px 0;line-height:1.5}
.ml-steps{padding-left:20px}
@keyframes ml-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes ml-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes ml-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@media (prefers-reduced-motion: reduce){.ml-card,.ml-tile,.ml-fab,.ml-opt.wrong{animation:none}}`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
  }

  function show(node) { panel.replaceChildren(node); panel.scrollTop = 0; }
  function close() { ov.classList.remove('open'); S = null; }
  function open() { S = null; ov.classList.add('open'); picker(); }
  function header(title) {
    return h('div', { class: 'ml-head' }, h('h2', {}, title), h('button', { class: 'ml-x', onclick: close }, '✕'));
  }
  const stat = (label, v) => h('div', { class: 'ml-stat' }, h('b', {}, String(v)), h('small', {}, label));

  function picker() {
    const d = load();
    const skillBars = Object.entries(SKILL).map(([k, v]) => {
      const got = d.skills[k][0], n = d.skills[k][1];
      const pct = n ? Math.round(got / n * 100) : 0;
      return h('div', { class: 'ml-skill' },
        h('div', { class: 'ml-row' }, h('span', {}, v.label), h('span', {}, n ? pct + '%' : 'no data yet')),
        h('div', { class: 'ml-bar' }, h('div', { class: 'ml-fill', style: 'width:' + pct + '%' })));
    });
    const ideas = ideaList();
    const list = ideas.length
      ? ideas.map(idea => {
          const A = analyze(idea);
          return h('button', { class: 'ml-idea', onclick: () => startIntro(idea) },
            h('strong', {}, A.title),
            h('small', {}, A.concepts.length + ' concepts · ' + A.steps.length + ' steps · ' + A.sentences.length + ' sentences'));
        })
      : [h('p', { class: 'ml-muted' }, 'No ideas yet. Capture an idea first, then come back here.')];
    show(h('div', { class: 'ml-card' },
      header('🧩 Mind Lab'),
      h('p', { class: 'ml-muted' }, 'Puzzles built from your own idea. Every round pays XP, win or lose. Your remarks show what to improve.'),
      h('div', { class: 'ml-stats' }, stat('XP', d.xp), stat('Rounds', d.rounds), stat('Wins', d.wins)),
      h('h4', {}, 'Your skills'),
      skillBars,
      h('h4', {}, 'Pick an idea'),
      list));
  }

  function startIntro(idea) {
    const A = analyze(idea);
    const qs = buildRound(A);
    S = { idea, A, qs, i: 0, xp: 0, streak: 0, results: [], answered: false, box: null };
    const board = A.concepts.slice(0, 6).map((c, i) => h('img', { class: 'ml-tile', src: window.hvVisualNote(c, i + 1, 240, 170).toDataURL(), alt: c }));
    const attached = A.images.slice(0, 4).map(src => h('img', { class: 'ml-tile', src, alt: 'Your attachment' }));
    const summary = [window.hvSummaryBlock ? window.hvSummaryBlock(idea) : h('p', { class: 'ml-muted' }, 'No summary yet.')];    show(h('div', { class: 'ml-card' },
      header('📖 ' + A.title),
      h('h4', {}, 'Summary'),
      summary.length ? summary : h('p', { class: 'ml-muted' }, 'Write a few full sentences about this idea to unlock sentence puzzles.'),
      h('h4', {}, 'Picture board'),
      h('div', { class: 'ml-board' }, board, attached),
      A.steps.length
        ? h('div', {}, h('h4', {}, 'Your steps'), h('ul', { class: 'ml-steps' }, A.steps.slice(0, 6).map(s => h('li', {}, s))))
        : h('p', { class: 'ml-muted' }, 'Add steps to unlock sequence puzzles.'),
      qs.length
        ? h('button', { class: 'ml-btn', onclick: renderQ }, 'Start round · ' + qs.length + ' questions')
        : h('p', { class: 'ml-muted' }, 'Not enough material yet. Add a few sentences or steps.'),
      h('button', { class: 'ml-ghost', onclick: picker }, '← Back')));
  }

  function renderQ() {
    const q = S.qs[S.i];
    S.answered = false;
    const box = h('div', { class: 'ml-card' });
    S.box = box;
    box.append(
      header('🧩 ' + S.A.title),
      h('div', { class: 'ml-row' },
        h('span', {}, 'Question ' + (S.i + 1) + ' of ' + S.qs.length),
        h('span', {}, '🔥 ' + S.streak + ' · ⭐ ' + S.xp + ' XP')),
      h('div', { class: 'ml-bar' }, h('div', { class: 'ml-fill', style: 'width:' + Math.round(S.i / S.qs.length * 100) + '%' })),
      h('h3', { class: 'ml-prompt' }, q.prompt));
    if (q.image) box.append(h('img', { class: 'ml-pic', src: q.image, alt: 'Picture for this question' }));
    if (q.body) box.append(h('p', { class: 'ml-body' }, q.body));
    if (q.type === 'sequence') renderSequence(q, box);
    else box.append(...renderChoice(q));
    show(box);
  }

  function renderChoice(q) {
    const opts = q.options.map(o => h('button', { class: 'ml-opt' }, o));
    opts.forEach(b => {
      b.onclick = () => {
        if (S.answered) return;
        const ok = b.textContent === q.answer;
        opts.forEach(x => {
          x.disabled = true;
          if (x.textContent === q.answer) x.classList.add('right');
        });
        if (!ok) b.classList.add('wrong');
        grade(q, ok ? 1 : 0, null);
      };
    });
    return opts;
  }

  function renderSequence(q, box) {
    const placed = [];
    const bank = q.shuffled.slice();
    const bankEl = h('div', { class: 'ml-bank' });
    const placedEl = h('div', { class: 'ml-placed' });
    const hint = h('p', { class: 'ml-muted' }, '');
    const draw = () => {
      bankEl.replaceChildren(...bank.map(it => h('button', {
        class: 'ml-chip',
        onclick: () => { bank.splice(bank.indexOf(it), 1); placed.push(it); draw(); },
      }, it.t)));
      placedEl.replaceChildren(...placed.map((it, k) => h('button', {
        class: 'ml-chip placed',
        onclick: () => { placed.splice(k, 1); bank.push(it); draw(); },
      }, (k + 1) + '. ' + it.t)));
    };
    draw();
    const lock = h('button', {
      class: 'ml-btn',
      onclick: () => {
        if (S.answered) return;
        if (placed.length < q.items.length) { hint.textContent = 'Place every step first.'; return; }
        const score = seqScore(placed.map(p => p.i), q.items.length);
        const reference = h('div', {},
          h('div', { class: 'ml-label' }, 'Reference order (your written plan)'),
          h('ol', { class: 'ml-steps' }, q.items.map(it => h('li', {}, it.t))));
        grade(q, score, reference);
      },
    }, 'Lock in order');
    box.append(h('div', { class: 'ml-label' }, 'Steps'), bankEl,
      h('div', { class: 'ml-label' }, 'Your order'), placedEl, hint, lock);
  }

  function grade(q, score, extra) {
    S.answered = true;
    const skill = SKILL_OF[q.type];
    S.results.push({ skill, score, prompt: q.prompt, why: q.why });

    let gained;
    if (score === 1) {
      S.streak += 1;
      gained = 10 + Math.min(S.streak - 1, 4) * 2;
    } else if (score > 0) {
      S.streak = 0;
      gained = Math.round(score * 10);
    } else {
      S.streak = 0;
      gained = 2;
    }
    S.xp += gained;

    const d = load();
    d.xp += gained;
    d.skills[skill][0] += score;
    d.skills[skill][1] += 1;
    save(d);

    const verdict = score === 1 ? '✅ Correct'
      : score > 0 ? '🟡 Partly right (' + Math.round(score * 100) + '%)'
      : '❌ Not this one';
    const cls = score === 1 ? 'ok' : score > 0 ? 'part' : 'bad';
    S.box.append(
      h('div', { class: 'ml-fb ' + cls },
        h('strong', {}, verdict),
        h('span', { class: 'ml-gain' }, '+' + gained + ' XP'),
        h('p', {}, q.why),
        extra),
      h('button', { class: 'ml-btn', onclick: nextQ }, S.i + 1 < S.qs.length ? 'Next →' : 'See results'));
  }

  function nextQ() {
    S.i += 1;
    if (S.i >= S.qs.length) finish();
    else renderQ();
  }

  function finish() {
    const d = load();
    const total = S.results.length || 1;
    const acc = S.results.reduce((a, r) => a + r.score, 0) / total;
    const correctCount = S.results.filter(r => r.score === 1).length;
    const win = acc >= WIN_AT;
    const bonus = 20 + (win ? 15 : 0);

    d.xp += bonus;
    d.rounds += 1;
    if (win) d.wins += 1;

    const earned = [];
    const grant = (k, cond) => {
      if (cond && !d.badges.includes(k)) { d.badges.push(k); earned.push(BADGES[k]); }
    };
    grant('first', d.rounds >= 1);
    grant('victory', win);
    grant('sharp', win && acc === 1 && S.results.length >= 3);
    grant('comeback', win && d.history.length > 0 && !d.history[0].win);
    grant('steady', d.rounds >= 5);

    d.history.unshift({
      title: S.A.title, win, acc: Math.round(acc * 100), date: new Date().toISOString().slice(0, 10),
    });
    d.history = d.history.slice(0, 30);
    save(d);

    const bySkill = {};
    S.results.forEach(r => { (bySkill[r.skill] = bySkill[r.skill] || []).push(r.score); });
    const remarks = Object.entries(bySkill).map(([k, arr]) => {
      const pct = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 100);
      return h('div', { class: 'ml-remark ' + (pct >= 80 ? 'good' : 'todo') },
        h('strong', {}, SKILL[k].label + ': ' + pct + '%'),
        h('p', {}, pct >= 80 ? SKILL[k].strong : SKILL[k].tip));
    });
    const misses = S.results.filter(r => r.score < 1).slice(0, 4).map(r => h('li', {}, r.why));

    show(h('div', { class: 'ml-card' },
      header(win ? '🏆 Victory' : '🌱 Round complete'),
      h('p', {}, correctCount + ' of ' + S.results.length + ' fully correct · ' + Math.round(acc * 100) + '% overall.'),
      h('p', { class: 'ml-muted' }, win
        ? 'Target was ' + Math.round(WIN_AT * 100) + '%. You won this round.'
        : 'Target is ' + Math.round(WIN_AT * 100) + '%. Not a win yet, but the XP still counts. Check the remarks below.'),
      h('div', { class: 'ml-reward' }, '+' + bonus + ' XP round reward' + (win ? ' (includes 15 victory bonus)' : '')),
      earned.length ? h('div', {}, earned.map(b => h('span', { class: 'ml-badge' }, b))) : null,
      h('h4', {}, 'Remarks'),
      remarks,
      misses.length ? h('h4', {}, 'Pay attention to') : null,
      misses.length ? h('ul', { class: 'ml-steps' }, misses) : null,
      h('button', { class: 'ml-btn', onclick: () => startIntro(S.idea) }, '↻ Play again'),
      h('button', { class: 'ml-ghost', onclick: picker }, 'Back to ideas')));
  }

  function init() {
    injectCSS();
    ov = h('div', { class: 'ml-ov' });
    panel = h('div', { class: 'ml-panel' });
    ov.append(panel);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    const fab = h('button', { class: 'ml-fab', onclick: open }, '🧩 Mind Lab');
    document.body.append(ov, fab);
    window.hiveLab = { open };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();