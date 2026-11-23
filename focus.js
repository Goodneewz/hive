/* focus.js: "One thing that matters today" and the focus room.
   - The focus room starts only when you press Begin. Nothing counts on its own.
   - If the page reloads during a session, it waits as paused. You press Resume.
   - Rewards: choosing your one thing (+5 XP once a day), finishing a session
     (5 XP + 1 per minute, +10 for a full session), finishing your one thing
     (+40 XP and a Big day). Big days in a row make a flame streak. */
(() => {
  'use strict';

  const SESS_KEY = 'hive-focus';
  const PREF_KEY = 'hive-focus-pref';
  const DURATIONS = [15, 25, 45];
  const RING = 552.92; // 2 × π × 88
  const ROTATE = [
    'Settle in. One thing at a time.',
    'Close the other tabs. They can wait.',
    'Your only job now is the next small step.',
    'Notice when your mind wanders, then gently come back.',
    'You already started. That is the hard part.',
    'Keep going. The hive is busy because you are.',
    'Almost there. Finish what you can and note the rest.'
  ];

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (x) => (typeof x === 'number' && isFinite(x) ? x : 0);
  const pad = (n) => String(n).padStart(2, '0');
  const mmss = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
  const say = (message, kind = 'ok', icon = '🐝') => { if (window.hiveToast) window.hiveToast(message, { kind, icon }); };
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const state = () => window.hiveLatest || null;
  const peekDay = (key) => (state()?.days || {})[key] || {};
  const pref = () => { const v = Number(localStorage.getItem(PREF_KEY)); return DURATIONS.includes(v) ? v : 25; };
  const fmtWhen = (v) => {
    const d = v instanceof Date ? v : new Date(v);
    if (window.hiveKit && window.hiveKit.formatStamp) return window.hiveKit.formatStamp(d);
    return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  function dayOf() {
    const s = state();
    if (!s) return {};
    s.days = s.days || {};
    const k = dayKey();
    s.days[k] = s.days[k] || {};
    return s.days[k];
  }

  function addXP(n) {
    const s = state();
    if (s) s.xp = num(s.xp) + n;
  }

  // ---------- saving (same database and key as the main app) ----------
  function writeState(s) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('hive', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('kv', 'readwrite');
        const store = tx.objectStore('kv');
        if (store.keyPath) store.put(s); else store.put(s, 'state');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function persist() {
    const s = state();
    if (!s) return;
    try { await writeState(s); } catch (e) { console.warn('[hive focus] save failed', e); }
    window.dispatchEvent(new Event('hive:saved'));
  }

  // ---------- the session (kept on this device) ----------
  function loadSess() {
    const fallback = { status: 'idle', total: pref() * 60, left: pref() * 60, endAt: 0, task: '', ideaId: '', taskId: '' };
    try { return { ...fallback, ...(JSON.parse(localStorage.getItem(SESS_KEY)) || {}) }; } catch { return fallback; }
  }
  let sess = loadSess();
  const saveSess = () => localStorage.setItem(SESS_KEY, JSON.stringify(sess));
  const leftNow = () => (sess.status === 'running' ? Math.max(0, Math.ceil((sess.endAt - Date.now()) / 1000)) : sess.left);

  let clock = null;
  function startClock() { stopClock(); clock = setInterval(tick, 500); tick(); }
  function stopClock() { if (clock) clearInterval(clock); clock = null; }

  function tick() {
    if (sess.status !== 'running') { stopClock(); return paintClock(); }
    if (leftNow() <= 0) return finish();
    paintClock();
  }

  function roomMessage() {
    if (sess.status === 'idle') return 'Ready when you are. Nothing starts until you press Begin.';
    if (sess.status === 'paused') return 'Paused. Take a breath. Press Resume when you are ready.';
    if (sess.status === 'done') {
      if (sess.full) return 'Finished. You stayed with it.';
      if (sess.lastXp) return 'Session saved. Every minute counts.';
      return 'Ended. Try again when you are ready.';
    }
    return ROTATE[Math.floor(((sess.total - leftNow()) / 60)) % ROTATE.length];
  }

  function paintClock() {
    const left = leftNow();
    const t = $('#hfTime');
    if (t) t.textContent = mmss(left);
    const arc = $('#hfArc');
    if (arc && sess.total) arc.style.strokeDashoffset = (RING * (1 - (sess.total - left) / sess.total)).toFixed(2);
    const m = $('#hfMsg');
    if (m && sess.status === 'running') m.textContent = roomMessage();
  }

  function begin() {
    if (sess.status !== 'idle') return;
    const input = $('#hfTaskIn');
    if (input) sess.task = input.value.trim().slice(0, 140);
    sess.total = pref() * 60;
    sess.left = sess.total;
    sess.endAt = Date.now() + sess.left * 1000;
    sess.status = 'running';
    saveSess();
    startClock();
    paintRoom();
    say('Focus started. Your timer is running.', 'ok', '🫧');
  }

  function pause() {
    if (sess.status !== 'running') return;
    sess.left = leftNow();
    sess.endAt = 0;
    sess.status = 'paused';
    stopClock();
    saveSess();
    paintRoom();
    paintFocus();
  }

  function resume() {
    if (sess.status !== 'paused') return;
    sess.endAt = Date.now() + sess.left * 1000;
    sess.status = 'running';
    saveSess();
    startClock();
    paintRoom();
  }

  function finish() {
    const left = leftNow();
    const full = left <= 0;
    const minutes = Math.floor((sess.total - left) / 60);
    const xp = minutes >= 1 ? Math.min(60, 5 + minutes) + (full ? 10 : 0) : 0;
    stopClock();
    sess.status = 'done';
    sess.left = 0;
    sess.endAt = 0;
    sess.full = full;
    sess.lastSpent = minutes;
    sess.lastXp = xp;
    const d = dayOf();
    d.focusMins = num(d.focusMins) + minutes;
    if (xp) addXP(xp);
    saveSess();
    persist();
    paintRoom();
    paintFocus();
    if (full) {
      confetti();
      say(`Focus complete. +${xp} XP. Want another round, or mark your one thing done?`, 'done', '🎉');
    } else if (minutes >= 1) {
      say(`Session ended after ${minutes} min. +${xp} XP. Every minute counts.`, 'ok', '🐝');
    } else {
      say('Ended early. No reward this time, and that is fine.', 'info', '🫧');
    }
  }

  function anotherRound() {
    sess.status = 'idle';
    sess.total = pref() * 60;
    sess.left = sess.total;
    sess.endAt = 0;
    saveSess();
    paintRoom();
    paintFocus();
  }

  function setDuration(m) {
    localStorage.setItem(PREF_KEY, String(m));
    if (sess.status === 'idle') {
      sess.total = m * 60;
      sess.left = m * 60;
      saveSess();
    }
    paintFocus();
    paintRoom();
  }

  function recover() {
    if (sess.status !== 'running') return;
    if (Date.now() >= sess.endAt) {
      finish(); // the session ended while the page was closed
    } else {
      sess.left = leftNow();
      sess.status = 'paused';
      sess.endAt = 0;
      saveSess();
    }
  }

  // ---------- one thing that matters today ----------
  function openTasks() {
    const out = [];
    const today = dayKey();
    for (const idea of state()?.ideas || []) {
      if (idea.status === 'done') continue;
      for (const t of idea.tasks || []) {
        if (t.done) continue;
        const when = t.scheduled || '';
        out.push({ ideaId: idea.id, taskId: t.id, text: t.text, when, idea: idea.title || 'Untitled', today: when.slice(0, 10) === today });
      }
    }
    out.sort((a, b) => (Number(b.today) - Number(a.today)) || ((a.when || '9999') < (b.when || '9999') ? -1 : (a.when || '9999') > (b.when || '9999') ? 1 : 0));
    return out.slice(0, 8);
  }

  function chooseOne(text, ideaId, taskId) {
    if (!text) return say('Type or pick one thing first.', 'info', '💭');
    const d = dayOf();
    d.one = { text: text.slice(0, 140), ideaId: ideaId || '', taskId: taskId || '', done: false, chosenAt: new Date().toISOString() };
    if (!d.oneChosenXP) {
      d.oneChosenXP = 1;
      addXP(5);
      say('Chosen. +5 XP for choosing wisely. Now give it your focus.', 'ok', '🎯');
    } else {
      say('Your one thing is set. Go and make it count.', 'ok', '🎯');
    }
    persist();
    paintOne();
    paintFocus();
  }

  function markOneDone() {
    const s = state();
    if (!s) return;
    const d = dayOf();
    if (!d.one) return say('Pick your one thing first.', 'info', '🎯');
    if (d.one.done) return;
    d.one.done = true;
    d.one.doneAt = new Date().toISOString();
    d.oneDone = 1;
    if (d.one.ideaId && d.one.taskId) {
      const idea = (s.ideas || []).find((i) => i.id === d.one.ideaId);
      const task = idea && (idea.tasks || []).find((t) => t.id === d.one.taskId);
      if (task) {
        task.done = true;
        if (idea.tasks.every((t) => t.done)) idea.status = 'done';
      }
    }
    addXP(40);
    persist();
    paintOne();
    paintRoom();
    const streak = bigStreak();
    say(`Big day! +40 XP.${streak > 1 ? ` ${streak} Big days in a row 🔥` : ''}`, 'done', '🎉');
    confetti();
  }

  function bigStreak() {
    if (!state()) return 0;
    const d = new Date();
    if (!peekDay(dayKey(d)).oneDone) d.setDate(d.getDate() - 1); // today is still open
    let n = 0;
    while (n < 730 && peekDay(dayKey(d)).oneDone) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  // ---------- painting Today ----------
  const durChips = (sel, attr) => DURATIONS.map((m) => `<button class="hf-chip${m === sel ? ' on' : ''}" ${attr}="dur" data-m="${m}">${m} min</button>`).join('');

  function paintOne() {
    const el = $('#hfOne');
    if (!el) return;
    const d = dayOf();
    const one = d.one;
    const streak = bigStreak();
    const streakLine = streak > 1 ? `🔥 ${streak} Big days in a row`
      : streak === 1 ? '⭐ One Big day so far. Keep it going.'
      : '⭐ Your first Big day starts when you finish one thing.';

    if (one) {
      el.innerHTML = `
        <div class="hf-card hf-one${one.done ? ' is-done' : ''}">
          <div class="hf-kicker">🎯 One thing that matters today</div>
          <div class="hf-big">${one.done ? '✅ ' : ''}${esc(one.text)}</div>
          <div class="hf-sub">${one.done ? 'Big day. You finished the thing that mattered most.' : 'Give this your best focus. Finish it and today becomes a Big day.'}</div>
          <div class="hf-note">${streakLine}</div>
          <div class="hf-row">
            ${one.done ? '' : `
              <button class="btn" data-hf="openSession">▶ Focus on it</button>
              <button class="btn ghost" data-hf="doneOne">🏁 Mark done · +40 XP</button>
              <button class="btn ghost" data-hf="changeOne">Change</button>`}
          </div>
        </div>`;
      return;
    }

    const tasks = openTasks();
    el.innerHTML = `
      <div class="hf-card">
        <div class="hf-kicker">🎯 One thing that matters today</div>
        <div class="hf-sub">Pick the one thing that would make today count. Everything else can wait a little.</div>
        ${tasks.length
          ? `<div class="hf-list">${tasks.map((t, i) => `
              <button class="hf-pick" data-hf="pick" data-i="${i}">
                <b>${esc(t.text)}</b>
                <span>${t.when ? '🕒 ' + esc(fmtWhen(t.when)) : '⏳ no time yet'} · ${esc(t.idea)}</span>
              </button>`).join('')}</div>`
          : '<div class="hf-sub">Your open steps will show here. Or type your own one thing below.</div>'}
        <div class="hf-row">
          <input id="hfOwn" value="${esc(d.checkin || '')}" placeholder="or type your own one thing" maxlength="140">
          <button class="btn" data-hf="ownOne">Set it</button>
        </div>
        <div class="hf-note">${streakLine}</div>
        <details class="hf-why">
          <summary>How the rewards work</summary>
          <p>Choosing your one thing: +5 XP, once a day. Finishing a focus session: 5 XP plus 1 per minute, and +10 when the full session completes. Finishing your one thing: +40 XP and a Big day. Big days in a row make a flame streak.</p>
        </details>
      </div>`;
  }

  function paintFocus() {
    const el = $('#hfFocus');
    if (!el) return;
    const mins = num(dayOf().focusMins);
    const paused = sess.status === 'paused'
      ? `<div class="hf-note">⏸ You have a paused session with ${Math.ceil(sess.left / 60)} min left. Open the focus room to resume it.</div>`
      : '';
    const last = sess.status === 'done' && sess.lastXp
      ? `<div class="hf-note">Last session: ${sess.lastSpent} min, +${sess.lastXp} XP.</div>`
      : '';
    el.innerHTML = `
      <div class="hf-card">
        <div class="hf-kicker">⏳ Focus room</div>
        <div class="hf-sub">A calm space for one job. It starts only when you press Begin, never on its own.</div>
        <div class="hf-row">${durChips(pref(), 'data-hf')}</div>
        <div class="hf-row"><button class="btn" data-hf="openSession">🫧 Open focus room</button></div>
        ${paused}${last}
        <div class="hf-sub">Focused today: <b>${mins} min</b></div>
      </div>`;
  }

  function paintToday() { paintOne(); paintFocus(); }

  // ---------- the focus room ----------
  function paintRoom() {
    const room = $('#hfRoomOverlay');
    if (!room) return;
    const st = sess.status;
    room.dataset.state = st;
    $('#hfRoomTask').innerHTML = st === 'idle'
      ? `<input id="hfTaskIn" value="${esc(sess.task)}" placeholder="What will you focus on?" maxlength="140">`
      : `<div class="hf-taskName">${esc(sess.task || 'Focus time')}</div>`;
    $('#hfDurs').innerHTML = st === 'idle' ? durChips(pref(), 'data-hfr') : '';

    const one = dayOf().one;
    const oneOpen = !!(one && !one.done);
    const btn = (act, label, cls = 'btn') => `<button class="${cls}" data-hfr="${act}">${label}</button>`;
    let ctrl = '';
    if (st === 'idle') ctrl = btn('begin', '▶ Begin focus');
    else if (st === 'running') ctrl = btn('pause', '⏸ Pause', 'btn ghost') + btn('finish', 'Finish now', 'btn ghost');
    else if (st === 'paused') ctrl = btn('resume', '▶ Resume') + btn('finish', 'Finish now', 'btn ghost');
    else ctrl = btn('another', '↻ Another round', 'btn ghost') + (oneOpen ? btn('doneOne', '🏁 Mark my one thing done') : '');
    $('#hfCtrl').innerHTML = ctrl;
    $('#hfMsg').textContent = roomMessage();
    paintClock();
  }

  function openRoom() {
    const room = $('#hfRoomOverlay');
    if (!room) return;
    const one = dayOf().one;
    if (sess.status === 'idle' && one && !one.done) {
      sess.task = one.text;
      sess.ideaId = one.ideaId;
      sess.taskId = one.taskId;
    }
    saveSess();
    room.classList.add('show');
    paintRoom();
    if (sess.status === 'running' && !clock) startClock();
  }

  function closeRoom() {
    $('#hfRoomOverlay')?.classList.remove('show');
    paintFocus();
  }

  // ---------- events ----------
  function onToday(e) {
    const b = e.target.closest('[data-hf]');
    if (!b || !state()) return;
    const act = b.dataset.hf;
    if (act === 'pick') {
      const t = openTasks()[Number(b.dataset.i)];
      if (t) chooseOne(t.text, t.ideaId, t.taskId);
    } else if (act === 'ownOne') {
      chooseOne(($('#hfOwn')?.value || '').trim(), '', '');
    } else if (act === 'changeOne') {
      dayOf().one = null;
      persist();
      paintOne();
    } else if (act === 'doneOne') {
      markOneDone();
    } else if (act === 'openSession') {
      openRoom();
    } else if (act === 'dur') {
      setDuration(Number(b.dataset.m));
    }
  }

  function onRoom(e) {
    const b = e.target.closest('[data-hfr]');
    if (!b) return;
    const act = b.dataset.hfr;
    if (act === 'close') closeRoom();
    else if (act === 'begin') begin();
    else if (act === 'pause') pause();
    else if (act === 'resume') resume();
    else if (act === 'finish') finish();
    else if (act === 'another') anotherRound();
    else if (act === 'doneOne') markOneDone();
    else if (act === 'dur') setDuration(Number(b.dataset.m));
  }

  function confetti() {
    const wrap = document.createElement('div');
    wrap.className = 'hf-confetti';
    const bits = ['🎉', '✨', '🐝', '⭐', '🍯'];
    for (let i = 0; i < 22; i++) {
      const s = document.createElement('span');
      s.textContent = bits[i % bits.length];
      s.style.left = `${Math.random() * 100}%`;
      s.style.animationDelay = `${Math.random() * 0.4}s`;
      s.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
      wrap.appendChild(s);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 3200);
  }

  // ---------- placing the new cards on Today ----------
  const oldEls = () => [$('#checkin'), $('#timerDisplay')].filter(Boolean);

  function hideOld(el) {
    const card = el.closest('.card');
    if (card && !card.querySelector('[data-tog],[data-open]')) card.style.display = 'none';
    else el.style.display = 'none';
  }

  function mount(first) {
    const anchor = first.closest('.card') || first;
    const sec = document.createElement('section');
    sec.id = 'hfToday';
    sec.className = 'hf-wrap';
    sec.innerHTML = '<div id="hfOne"></div><div id="hfFocus"></div>';
    sec.addEventListener('click', onToday);
    anchor.parentNode.insertBefore(sec, anchor);
    paintToday();
  }

  function ensure() {
    const olds = oldEls();
    if (!olds.length) return;
    if (!document.getElementById('hfToday')) mount(olds[0]);
    olds.forEach(hideOld);
  }

  function watch() {
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        try { ensure(); } catch (e) { console.warn('[hive focus] placing cards', e); }
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ---------- style ----------
  const CSS = `
.hf-wrap{display:grid;gap:12px;margin:0 0 14px}
.hf-card{background:var(--panel,#111b2e);border:1px solid var(--line,#22304a);border-radius:16px;padding:14px;animation:hfIn .35s ease both}
.hf-one{border-color:var(--accent,#ffb800);background:linear-gradient(160deg,#1a2740,#111b2e)}
.hf-one.is-done{border-color:var(--ok,#34d399)}
.hf-kicker{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--accent,#ffb800);font-weight:700}
.hf-big{font-size:20px;font-weight:800;margin:6px 0;line-height:1.3}
.hf-sub{font-size:13px;color:var(--muted,#8b97b5);margin:4px 0;line-height:1.45}
.hf-note{font-size:13px;margin:8px 0}
.hf-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
.hf-card input{flex:1;min-width:160px;padding:9px 11px;border-radius:10px;border:1px solid var(--line,#22304a);background:#0b1424;color:var(--text,#eef2ff);font:inherit;box-sizing:border-box}
.hf-list{display:grid;gap:6px;margin:8px 0}
.hf-pick{display:grid;gap:2px;text-align:left;background:#0b1424;color:var(--text,#eef2ff);border:1px dashed var(--line,#22304a);border-radius:12px;padding:10px;cursor:pointer;font:inherit;transition:transform .15s,border-color .15s}
.hf-pick:hover{transform:translateX(3px);border-color:var(--accent,#ffb800)}
.hf-pick span{font-size:12px;color:var(--muted,#8b97b5)}
.hf-chip{background:var(--chip,#1d2a45);color:var(--text,#eef2ff);border:0;border-radius:999px;padding:6px 12px;cursor:pointer;font:inherit;font-size:13px}
.hf-chip.on{background:var(--accent,#ffb800);color:#1a1200;font-weight:700}
.hf-why{font-size:13px;color:var(--muted,#8b97b5);margin-top:6px}
.hf-why p{margin:6px 0 0;line-height:1.5}
.hf-room{position:fixed;inset:0;z-index:95;display:none;background:radial-gradient(circle at 50% 35%,#1d2a45 0%,#0b1426 55%,#050a14 100%);color:var(--text,#eef2ff);overflow:hidden;justify-content:center;align-items:center}
.hf-room.show{display:flex;animation:hfIn .4s ease both}
.hf-room::before{content:"";position:absolute;inset:-40px;background:radial-gradient(circle,rgba(255,184,0,.14) 2px,transparent 3px) 0 0/46px 46px;animation:hfDrift 40s linear infinite;pointer-events:none;opacity:.6}
.hf-inner{position:relative;display:grid;justify-items:center;gap:14px;padding:20px;width:min(520px,100%);box-sizing:border-box;text-align:center}
.hf-top{display:flex;justify-content:space-between;align-items:center;width:100%}
.hf-taskName{font-size:18px;font-weight:700}
#hfTaskIn{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid var(--line,#22304a);background:#0b1424;color:var(--text,#eef2ff);font:inherit;text-align:center;font-size:17px}
.hf-ringWrap{position:relative;width:min(280px,70vw);aspect-ratio:1/1}
.hf-ring{width:100%;height:100%;transform:rotate(-90deg)}
.hf-track{fill:none;stroke:rgba(255,255,255,.08);stroke-width:10}
.hf-arc{fill:none;stroke:url(#hfGrad);stroke-width:10;stroke-linecap:round;stroke-dasharray:552.92;stroke-dashoffset:552.92;transition:stroke-dashoffset .6s linear;filter:drop-shadow(0 0 8px rgba(255,184,0,.45))}
.hf-time{position:absolute;inset:0;display:grid;place-items:center;font-size:clamp(40px,10vw,56px);font-weight:800;font-variant-numeric:tabular-nums}
.hf-room[data-state="running"] .hf-ringWrap{animation:hfBreath 4s ease-in-out infinite}
.hf-msg{min-height:3em;font-size:16px;line-height:1.45;max-width:420px}
.hf-tip{font-size:12px;color:var(--muted,#8b97b5);max-width:420px}
.hf-confetti{position:fixed;inset:0;pointer-events:none;z-index:120;overflow:hidden}
.hf-confetti span{position:absolute;top:-8%;font-size:22px;animation:hfFall 2.8s ease-in forwards}
@keyframes hfIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes hfDrift{to{transform:translate(46px,46px)}}
@keyframes hfBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
@keyframes hfFall{to{transform:translate(var(--dx,0),110vh) rotate(360deg);opacity:.2}}
@media (prefers-reduced-motion: reduce){#hfToday *,.hf-room *,.hf-room::before,.hf-confetti span{animation:none!important;transition:none!important}}
`;

  // ---------- start ----------
  function init() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const room = document.createElement('div');
    room.className = 'hf-room';
    room.id = 'hfRoomOverlay';
    room.setAttribute('role', 'dialog');
    room.setAttribute('aria-modal', 'true');
    room.innerHTML = `
      <div class="hf-inner">
        <div class="hf-top">
          <span class="hf-kicker">🫧 Focus room</span>
          <button class="btn ghost" data-hfr="close">Close</button>
        </div>
        <div id="hfRoomTask"></div>
        <div class="hf-ringWrap">
          <svg class="hf-ring" viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <linearGradient id="hfGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#ffd54a"/>
                <stop offset="1" stop-color="#ff9f1c"/>
              </linearGradient>
            </defs>
            <circle class="hf-track" cx="100" cy="100" r="88"/>
            <circle class="hf-arc" id="hfArc" cx="100" cy="100" r="88"/>
          </svg>
          <div class="hf-time" id="hfTime">25:00</div>
        </div>
        <div class="hf-msg" id="hfMsg"></div>
        <div class="hf-row" id="hfDurs"></div>
        <div class="hf-row" id="hfCtrl"></div>
        <div class="hf-tip">Put the phone face down. Nothing here starts by itself. Closing this window does not stop a running timer.</div>
      </div>`;
    document.body.appendChild(room);
    room.addEventListener('click', onRoom);
    room.addEventListener('input', (e) => {
      if (e.target.id === 'hfTaskIn') {
        sess.task = e.target.value.slice(0, 140);
        saveSess();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && room.classList.contains('show')) closeRoom();
    });

    // The old timer button never starts a timer now. It opens the focus room.
    document.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('#timerBtn');
      if (t) {
        e.preventDefault();
        e.stopImmediatePropagation();
        openRoom();
      }
    }, true);

    watch();

    const waitForState = () => {
      const s = state();
      if (s && s.ideas) {
        recover();
        ensure();
        paintToday();
        paintRoom();
        if (sess.status === 'running' && !clock) startClock();
      } else {
        setTimeout(waitForState, 300);
      }
    };
    waitForState();
  }

  init();
  window.hiveFocus = { open: openRoom };
})();