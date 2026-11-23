/* assistant.js: Hive's assistant.
   - Asks one creative clarifying question at a time, answering from the idea what it can.
   - Checks the summary with you in a short chat (confirm, or add what's missing).
   - Suggests plan steps, with times it read from your text. You accept or decline each one.
   Works with no AI key (rule-based). An AI provider can replace the replies later. */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pick = (arr, seed) => arr[Math.abs(seed | 0) % arr.length];
  const hashStr = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const say = (message, kind = 'ok', icon = '🐝') => { if (window.hiveToast) window.hiveToast(message, { kind, icon }); };
  const pad = (n) => String(n).padStart(2, '0');
  const stampLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fmtWhen = (v) => {
    const d = v instanceof Date ? v : new Date(v);
    if (window.hiveKit && window.hiveKit.formatStamp) return window.hiveKit.formatStamp(d);
    return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const NOT_NAMES = new Set(['I', 'The', 'A', 'An', 'We', 'My', 'This', 'That', 'It', 'And', 'But', 'Or', 'If', 'When', 'Then', 'Also', 'Need', 'Want', 'Maybe', 'Today', 'Tomorrow', 'Tonight', 'Morning', 'Afternoon', 'Evening', 'Night', 'Noon', 'Next', 'In', 'On', 'At', 'So', 'Just', 'Please', 'Hive', 'Idea', 'Plan', 'Step', 'Steps', 'Summary', 'Make', 'Do', 'Let', 'Get', 'Use', 'Some', 'Of', 'To', 'For', 'With', 'From', 'After', 'Before', 'Later', 'First', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Yes', 'No', 'Ok', 'Okay', 'Still', 'Once', 'Only']);
  const ACTION = /^(call|email|text|message|buy|get|pick|write|send|build|make|finish|book|plan|fix|read|study|design|draft|check|visit|ask|prepare|practi[cs]e|learn|clean|pay|cook|record|post|share|test|launch|review|sketch|research|set|schedule|order|register|apply|submit|print|sort|organi[sz]e|meet|join|start|try|open|update|upload|find|collect|bring|take|cancel|renew|tidy|rehearse|draw|cut|paint|complete)\b/i;
  const NEED = /\b(?:need to|have to|must|should|remember to|going to|want to|gotta)\s+(.+)/i;

  // ---------- reading the text ----------
  function tidy(t) {
    let s = String(t || '').replace(/\s+/g, ' ')
      .replace(/^(to|and|then)\s+/i, '')
      .replace(/[\s,;:\-–—]+$/, '')
      .replace(/\s+(at|on|by|in|for|around|tomorrow|today)$/i, '')
      .trim();
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return s.slice(0, 90);
  }

  function readWhen(s) {
    let text = s;
    let when = '';
    try {
      const r = window.hiveKit && window.hiveKit.parseWhen(s, new Date());
      if (r && r.found) {
        if (r.cleaned) text = r.cleaned;
        if (r.hasTime) when = stampLocal(r.when instanceof Date ? r.when : new Date(r.when));
      }
    } catch (e) { console.warn('[hive assist] time read', e); }
    return { text: tidy(text), when };
  }

  // Splits text into sentences that look like actions or carry a time.
  function candidates(text) {
    const out = [];
    for (const raw of String(text || '').split(/\n|;|(?<=[.!?])\s+/)) {
      let s = raw.trim().replace(/^([-*•]|\d+[.)])\s*/, '');
      if (!s) continue;
      const need = s.match(NEED);
      if (need) s = need[1];
      const timed = !!(window.hiveKit && window.hiveKit.parseWhen(s, new Date()).found);
      if (ACTION.test(s) || timed) out.push(s);
    }
    return out;
  }

  function guessGoal(idea) {
    const first = String(idea.body || '').split(/[.!?\n]/)[0].trim();
    return (idea.title || first || 'something you want to get done').slice(0, 120);
  }

  function summaryText() {
    return (document.querySelector('#summary')?.textContent || '').trim();
  }

  // ---------- what is stored per idea (saved inside the idea, so it syncs) ----------
  function A(idea) {
    if (!idea.assist) idea.assist = { answers: {}, skipped: [], notes: [], chat: [], declined: [], confirmed: false };
    return idea.assist;
  }

  function ctxOf(idea) {
    const a = A(idea);
    const text = [idea.title, idea.body, ...a.notes].filter(Boolean).join('. ');
    let when = { found: false };
    try { if (window.hiveKit) when = window.hiveKit.parseWhen(text, new Date()) || when; } catch (e) { /* keep default */ }
    const names = [...new Set((text.match(/\b[A-Z][a-z]{2,}\b/g) || []).filter((w) => !NOT_NAMES.has(w)))].slice(0, 5);
    return {
      text: text.toLowerCase(),
      when,
      names,
      candidates: candidates(text),
      attachments: (idea.attachments || []).length,
      answers: a.answers
    };
  }

  // ---------- creative clarifying questions (one at a time) ----------
  const QUESTIONS = [
    { id: 'people', icon: '🫶', ask: (c) => !c.names.length,
      text: "Every good plan has someone it's for. Who is it for? Give them a name, even a made-up one, and tell me what they'd say when it's done." },
    { id: 'when', icon: '🗓️', ask: (c) => !c.when.found,
      text: "If this idea had a calendar day, which day would it wear? Pick a day, a part of the day, or say \"whenever I'm brave\"." },
    { id: 'blocker', icon: '🐉', ask: (c) => !/stuck|problem|worr|hard|difficult|risk|can'?t|cannot|don'?t know|no money|tired|busy|afraid|scared|late/.test(c.text),
      text: 'Every quest has a dragon. What is the one thing most likely to get in the way?' },
    { id: 'why', icon: '💡', ask: (c) => !/because|so that|to help|why|matters|so i|for my/.test(c.text),
      text: 'If you let this go for a month, what would quietly go wrong?' },
    { id: 'done', icon: '🏁', ask: () => true,
      text: "How will you know it's finished? Describe that moment in one sentence, like the last scene of a film." },
    { id: 'start', icon: '🐣', ask: (c) => c.candidates.length < 2,
      text: 'If you could do one tiny thing today to move this, what would it be? Make it small enough to finish in ten minutes.' },
    { id: 'tools', icon: '🧰', ask: (c) => !c.attachments,
      text: 'What do you already have that could help? A tool, a person, a sketch, a page of notes?' }
  ];

  function nextQuestion(idea) {
    const a = A(idea);
    const c = ctxOf(idea);
    return QUESTIONS.find((q) => !a.answers[q.id] && !a.skipped.includes(q.id) && q.ask(c)) || null;
  }

  function knownList(idea) {
    const c = ctxOf(idea);
    const out = [];
    if (c.when.found && c.when.hasTime) out.push(`🕒 You wrote a time: <b>${esc(fmtWhen(c.when.when))}</b>`);
    if (c.names.length) out.push(`👤 Names I noticed: <b>${esc(c.names.join(', '))}</b>`);
    const n = c.candidates.length;
    if (n) out.push(`✅ I found ${n} possible step${n === 1 ? '' : 's'} in your writing`);
    if (c.attachments) out.push(`📎 You added ${c.attachments} attachment${c.attachments === 1 ? '' : 's'}`);
    return out;
  }

  // ---------- discussion: a plain-language understanding ----------
  function understanding(idea) {
    const a = A(idea);
    const c = ctxOf(idea);
    const parts = [`The goal: ${a.answers.goal || guessGoal(idea)}.`];
    if (c.when.found && c.when.hasTime) parts.push(`When: ${fmtWhen(c.when.when)}.`);
    else if (a.answers.when) parts.push(`When: ${a.answers.when}.`);
    if (a.answers.people) parts.push(`It is for: ${a.answers.people}.`);
    if (a.answers.done) parts.push(`It is finished when: ${a.answers.done}.`);
    if (a.answers.why) parts.push(`It matters because: ${a.answers.why}.`);
    if (a.answers.blocker) parts.push(`Watch out for: ${a.answers.blocker}.`);
    if (a.answers.tools) parts.push(`Helpful things you have: ${a.answers.tools}.`);
    if (a.notes.length) parts.push(`You also said: ${a.notes.join(' ')}`);
    return parts.join(' ');
  }

  function reply(idea, a, msg) {
    const low = msg.toLowerCase();
    const short = msg.split(/\s+/).length <= 6;
    if (short && /^(yes|yep|yeah|correct|right|exactly|that'?s it|agreed?|ok|okay|looks good|sounds right)\b/.test(low)) {
      a.confirmed = true;
      return "Lovely. I've marked the picture as right. Next, check the steps in the plan helper.";
    }
    if (short && /^(no|nope|wrong|incorrect|isn'?t|doesn'?t|not right)\b/.test(low)) {
      a.confirmed = false;
      return "Thanks for being honest. Tell me the part that's off, in your own words, and I'll fix the picture.";
    }
    if (/\?\s*$/.test(low) && /\b(first|next|start|begin)\b/.test(low)) {
      const s = suggestions(idea)[0];
      return s
        ? `I'd start with: "${s.text}". Accept it in the plan helper if it fits.`
        : "I don't have a clear first step yet. Tell me what you'd do first, even if it's small.";
    }
    a.notes.push(msg.slice(0, 300));
    let text = pick([
      "Got it. I've tucked that into the picture.",
      'Nice detail. That changes the picture a little.',
      "Thanks. I'm keeping that in mind."
    ], hashStr(msg));
    const r = window.hiveKit && window.hiveKit.parseWhen(msg, new Date());
    if (r && r.found && r.hasTime) {
      text += ` I also read a time: ${fmtWhen(r.when)}. It is in the plan helper as a suggestion.`;
    }
    return text;
  }

  // ---------- plan suggestions (nothing is added until accepted) ----------
  function suggestions(idea) {
    const a = A(idea);
    const seen = new Set((idea.tasks || []).map((t) => norm(t.text)));
    const out = [];
    const add = (text, when, reason) => {
      const key = norm(text);
      if (!key || seen.has(key) || a.declined.includes(key)) return;
      seen.add(key);
      out.push({ key, text, when, reason });
    };
    for (const s of candidates([idea.title, idea.body].filter(Boolean).join('\n'))) {
      const r = readWhen(s);
      add(r.text, r.when, r.when
        ? 'You wrote a time for this in your idea, so I placed it at that time.'
        : 'It reads like an action in what you wrote.');
    }
    for (const n of a.notes) {
      for (const s of candidates(n)) {
        const r = readWhen(s);
        add(r.text, r.when, 'You told me this in the discussion.');
      }
    }
    if (a.answers.start) {
      const r = readWhen(a.answers.start);
      add(r.text, r.when, 'You named this as a tiny first move. Small starts make big plans move.');
    }
    if (a.answers.blocker) {
      add(tidy(`Deal with this first: ${a.answers.blocker}`), '', 'You said this could get in the way. Dealing with it early saves trouble later.');
    }
    return out.slice(0, 6);
  }

  function makeTask(text, when) {
    const t = { id: uid(), text, done: false, mins: 30 };
    if (when) t.scheduled = when;
    return t;
  }

  // ---------- saving ----------
  function writeState(state) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('hive', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('kv', 'readwrite');
        const store = tx.objectStore('kv');
        if (store.keyPath) store.put(state); else store.put(state, 'state');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function persist() {
    const s = window.hiveLatest;
    if (!s) return;
    try { await writeState(s); } catch (e) { console.warn('[hive assist] save failed', e); }
    window.dispatchEvent(new Event('hive:saved')); // lets the account sync pick it up
  }

  // Reopens the idea so the plan list on the page shows new steps.
  function refreshModal(id) {
    const card = document.querySelector(`[data-open="${CSS.escape(id)}"]`);
    if (card) card.click();
    renderAll();
  }

  function changed(idea, msg, icon = '🐝') {
    persist();
    renderAll();
    if (msg) say(msg, 'ok', icon);
  }

  // ---------- which idea is open ----------
  let lastOpenId = '';
  let mountedFor = null;
  let lastSummary = null;

  function currentIdea() {
    const ideas = (window.hiveLatest && window.hiveLatest.ideas) || [];
    const byOpen = ideas.find((i) => i.id === lastOpenId);
    if (byOpen) return byOpen;
    const bodyVal = document.querySelector('#eBody')?.value;
    const titleVal = document.querySelector('#eTitle')?.value;
    return ideas.find((i) => bodyVal !== undefined && i.body === bodyVal)
      || ideas.find((i) => titleVal !== undefined && i.title === titleVal)
      || null;
  }

  function getCtx() {
    const idea = currentIdea();
    return idea ? { idea, a: A(idea) } : null;
  }

  // ---------- rendering ----------
  function renderAll() { renderAsk(); renderTalk(); renderPlan(); }

  function renderAsk() {
    const el = document.getElementById('hvAsk');
    const idea = currentIdea();
    if (!el || !idea) return;
    const a = A(idea);
    const q = nextQuestion(idea);
    const known = knownList(idea);
    el.innerHTML = `
      <div class="hv-card">
        <div class="hv-head">
          <span class="hv-bee">🧠</span>
          <div><b>Let's think it through</b>
            <div class="hv-sub">I read your idea first. You only answer what I can't work out.</div>
          </div>
        </div>
        ${known.length ? `<ul class="hv-known">${known.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
        ${a.answers.goal ? '' : `
          <div class="hv-guess">🎯 From your first line, the goal sounds like <b>“${esc(guessGoal(idea))}”</b>.
            <div class="hv-row"><button class="btn ghost hv-small-btn" data-hv="goal">Yes, that's it</button></div>
          </div>`}
        ${q ? `
          <div class="hv-q"><div class="hv-qicon">${q.icon}</div><div class="hv-qtext">${esc(q.text)}</div></div>
          <textarea id="hvAnswer" rows="2" placeholder="Answer in your own words. Ctrl+Enter to send."></textarea>
          <div class="hv-row">
            <button class="btn" data-hv="answer" data-q="${q.id}">Answer</button>
            <button class="btn ghost" data-hv="skip" data-q="${q.id}">Skip</button>
          </div>`
          : '<p class="hv-sub">🎉 I have what I need for now. Check the discussion below.</p>'}
      </div>`;
  }

  function renderTalk() {
    const el = document.getElementById('hvTalk');
    const idea = currentIdea();
    if (!el || !idea) return;
    const a = A(idea);
    const sum = summaryText();
    const log = [
      { who: 'hive', text: "Here's my understanding of your idea. Does it sound right? If something is missing, tell me, and I'll take it in." },
      ...a.chat
    ];
    el.innerHTML = `
      <div class="hv-card">
        <div class="hv-head">
          <span class="hv-bee">💬</span>
          <div><b>Check it together</b>
            <div class="hv-sub">${sum ? 'Does the summary match what you meant?' : 'Tap Summarize above first. Then we can check it together.'}</div>
          </div>
        </div>
        ${sum ? `<div class="hv-sub">📝 Summary above</div><div class="hv-under">${esc(sum.slice(0, 500))}</div>` : ''}
        <div class="hv-sub">🪞 What I understood</div>
        <div class="hv-under">${esc(understanding(idea))}</div>
        <div class="hv-row">
          <button class="btn" data-hv="agree">${a.confirmed ? '✅ Confirmed' : "✅ Yes, that's right"}</button>
          <button class="btn ghost" data-hv="notquite">✏️ Not quite</button>
        </div>
        <div class="hv-chat">${log.map((m) => `<div class="hv-msg ${m.who}">${esc(m.text)}</div>`).join('')}</div>
        <div class="hv-row">
          <input id="hvChat" placeholder="Tell me what's missing, or ask me anything…">
          <button class="btn" data-hv="send">Send</button>
        </div>
      </div>`;
    const box = el.querySelector('.hv-chat');
    if (box) box.scrollTop = box.scrollHeight;
  }

  function renderPlan() {
    const el = document.getElementById('hvPlan');
    const idea = currentIdea();
    if (!el || !idea) return;
    const list = suggestions(idea);
    el.innerHTML = `
      <div class="hv-card">
        <div class="hv-head">
          <span class="hv-bee">🗺️</span>
          <div><b>Plan helper</b>
            <div class="hv-sub">Here are some steps I found. You decide which ones stay.</div>
          </div>
        </div>
        <details class="hv-why">
          <summary>How I planned this</summary>
          <p>I looked for actions in what you wrote and in our chat, and I read any times you gave. If you named something that could get in the way, I added a step to deal with it early. Nothing is added until you tap <b>Accept</b>. A step without a time goes into the Week view with 30 minutes. A step with a time gets a reminder.</p>
        </details>
        ${list.length
          ? `<div class="hv-row"><button class="btn" data-hv="acceptAll">Accept all ${list.length}</button></div>`
          : '<p class="hv-sub">No new suggestions right now. Add your own step below.</p>'}
        <div class="hv-sugs">
          ${list.map((s) => `
            <div class="hv-sug">
              <b>${esc(s.text)}</b>
              <div class="hv-chip">${s.when ? '🕒 ' + esc(fmtWhen(s.when)) : '⏳ no time yet'}</div>
              <div class="hv-sub">${esc(s.reason)}</div>
              <div class="hv-row">
                <button class="btn" data-hv="accept" data-key="${esc(s.key)}">Accept</button>
                <button class="btn ghost" data-hv="decline" data-key="${esc(s.key)}">Decline</button>
              </div>
            </div>`).join('')}
        </div>
        <div class="hv-own">
          <div class="hv-sub">Your own step</div>
          <div class="hv-row">
            <input id="hvOwn" placeholder="e.g. Call Ada at 3pm">
            <button class="btn" data-hv="own">Add</button>
          </div>
          <div class="hv-sub">Write a time too, like "call Ada at 3pm". I'll read it.</div>
        </div>
      </div>`;
  }

  // ---------- actions ----------
  function sendChat(idea, a) {
    const input = document.getElementById('hvChat');
    const msg = (input?.value || '').trim();
    if (!msg) return;
    a.chat.push({ who: 'you', text: msg.slice(0, 400) });
    a.chat.push({ who: 'hive', text: reply(idea, a, msg) });
    if (a.chat.length > 40) a.chat = a.chat.slice(-40);
    changed(idea);
    document.getElementById('hvChat')?.focus();
  }

  function addOwn(idea) {
    const raw = (document.getElementById('hvOwn')?.value || '').trim();
    if (!raw) return say('Type a step first.', 'info', '💭');
    const r = readWhen(raw);
    if (!r.text) return;
    idea.tasks = idea.tasks || [];
    idea.tasks.push(makeTask(r.text, r.when));
    persist();
    refreshModal(idea.id);
    say(r.when ? `Added. I'll remind you at ${fmtWhen(r.when)}.` : 'Added to your plan.', 'ok', '🗺️');
  }

  function onClick(e) {
    const b = e.target.closest('[data-hv]');
    if (!b) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { idea, a } = ctx;
    const act = b.dataset.hv;

    if (act === 'goal') {
      a.answers.goal = guessGoal(idea);
      return changed(idea, 'Thanks. That is the goal now.', '🎯');
    }
    if (act === 'answer') {
      const qid = b.dataset.q;
      const v = (document.getElementById('hvAnswer')?.value || '').trim();
      if (!v) return say('Type a few words, or tap Skip.', 'info', '💭');
      a.answers[qid] = v;
      return changed(idea, pick(["Lovely, I'll use that.", 'Got it. That sharpens the plan.', "Nice clue. I'm keeping it."], hashStr(v)), '✨');
    }
    if (act === 'skip') {
      if (!a.skipped.includes(b.dataset.q)) a.skipped.push(b.dataset.q);
      return changed(idea);
    }
    if (act === 'agree') {
      a.confirmed = true;
      a.chat.push({ who: 'hive', text: "Lovely, I've marked this as right. Now let's check the steps in the plan helper." });
      return changed(idea, 'Marked as right.', '✅');
    }
    if (act === 'notquite') {
      a.confirmed = false;
      a.chat.push({ who: 'hive', text: "Thanks for checking. Tell me the part that's off, in your own words. I'll add it to the picture." });
      changed(idea);
      document.getElementById('hvChat')?.focus();
      return;
    }
    if (act === 'send') return sendChat(idea, a);
    if (act === 'accept') {
      const s = suggestions(idea).find((x) => x.key === b.dataset.key);
      if (!s) return renderAll();
      idea.tasks = idea.tasks || [];
      idea.tasks.push(makeTask(s.text, s.when));
      persist();
      refreshModal(idea.id);
      return say(s.when ? `Added at ${fmtWhen(s.when)}.` : 'Added to your plan.', 'ok', '🗺️');
    }
    if (act === 'decline') {
      const key = b.dataset.key;
      if (!a.declined.includes(key)) a.declined.push(key);
      return changed(idea);
    }
    if (act === 'acceptAll') {
      const list = suggestions(idea);
      idea.tasks = idea.tasks || [];
      for (const s of list) idea.tasks.push(makeTask(s.text, s.when));
      persist();
      refreshModal(idea.id);
      return say(`Added ${list.length} step${list.length === 1 ? '' : 's'} to your plan.`, 'ok', '🗺️');
    }
    if (act === 'own') return addOwn(idea);
  }

  function onKey(e) {
    if (e.key !== 'Enter') return;
    const ctx = getCtx();
    if (!ctx) return;
    if (e.target.id === 'hvChat') {
      e.preventDefault();
      sendChat(ctx.idea, ctx.a);
    } else if (e.target.id === 'hvOwn') {
      e.preventDefault();
      addOwn(ctx.idea);
    } else if (e.target.id === 'hvAnswer' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      document.querySelector('[data-hv="answer"]')?.click();
    }
  }

  // ---------- mounting into the idea window ----------
  function mount(idea) {
    const body = document.querySelector('#ideaBody');
    if (!body) return;
    let box = document.getElementById('hvAssist');
    if (!box) {
      box = document.createElement('section');
      box.id = 'hvAssist';
      box.innerHTML = '<div id="hvAsk"></div><div id="hvTalk"></div><div id="hvPlan"></div>';
      box.addEventListener('click', onClick);
      box.addEventListener('keydown', onKey);
      body.appendChild(box);
    }
    mountedFor = idea.id;
    lastSummary = summaryText();
    renderAll();
  }

  function check() {
    const idea = currentIdea();
    if (!idea) return;
    if (!document.getElementById('hvAssist') || mountedFor !== idea.id) { mount(idea); return; }
    const s = summaryText();
    if (s !== lastSummary) { lastSummary = s; renderTalk(); }
  }

  function watch() {
    const body = document.querySelector('#ideaBody');
    if (!body) { setTimeout(watch, 500); return; }
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; check(); });
    }).observe(body, { childList: true, subtree: true });
  }

  // ---------- style ----------
  const CSS = `
#hvAssist{margin-top:14px;display:grid;gap:12px}
.hv-card{background:var(--panel,#111b2e);border:1px solid var(--line,#22304a);border-radius:16px;padding:14px;animation:hvIn .35s ease both}
.hv-head{display:flex;gap:10px;align-items:flex-start;margin-bottom:8px}
.hv-bee{font-size:26px;line-height:1;animation:hvBob 2.4s ease-in-out infinite}
.hv-sub{font-size:12px;color:var(--muted,#8b97b5);margin:4px 0}
.hv-known{margin:8px 0;padding-left:0;list-style:none;display:grid;gap:4px;font-size:13px}
.hv-guess{background:#0b1424;border-radius:12px;padding:10px;margin:8px 0;font-size:14px}
.hv-q{display:flex;gap:10px;align-items:flex-start;margin:10px 0 6px}
.hv-qicon{font-size:22px}
.hv-qtext{font-size:15px;line-height:1.4}
#hvAssist textarea,#hvAssist input{width:100%;box-sizing:border-box;padding:9px 11px;border-radius:10px;border:1px solid var(--line,#22304a);background:#0b1424;color:var(--text,#eef2ff);font:inherit}
#hvAssist textarea{resize:vertical}
.hv-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;align-items:center}
.hv-row input{flex:1;min-width:160px}
.hv-small-btn{padding:4px 10px;font-size:13px}
.hv-under{background:#0b1424;border-radius:12px;padding:10px;font-size:14px;line-height:1.5;border-left:3px solid var(--accent,#ffb800);margin:6px 0}
.hv-chat{display:grid;gap:6px;margin:10px 0;max-height:240px;overflow:auto}
.hv-msg{max-width:88%;padding:8px 11px;border-radius:14px;font-size:14px;line-height:1.4;animation:hvIn .25s ease both}
.hv-msg.hive{background:var(--chip,#1d2a45);justify-self:start}
.hv-msg.you{background:var(--accent,#ffb800);color:#1a1200;justify-self:end}
.hv-why{font-size:13px;color:var(--muted,#8b97b5);margin:6px 0}
.hv-why p{margin:6px 0 0;line-height:1.5}
.hv-sugs{display:grid;gap:8px;margin-top:6px}
.hv-sug{background:#0b1424;border:1px dashed var(--line,#22304a);border-radius:12px;padding:10px;animation:hvIn .3s ease both}
.hv-chip{display:inline-block;font-size:12px;background:var(--chip,#1d2a45);border-radius:999px;padding:2px 9px;margin:4px 0}
.hv-own{margin-top:12px;border-top:1px solid var(--line,#22304a);padding-top:10px}
@keyframes hvIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes hvBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@media (prefers-reduced-motion: reduce){#hvAssist *{animation:none!important}}
`;

  function init() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    document.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-open]');
      if (el && el.dataset.open) lastOpenId = el.dataset.open;
    }, true);
    watch();
  }

  init();
  window.hiveAssist = { refresh: () => renderAll() };
})();