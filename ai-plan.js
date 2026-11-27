/* ai-plan.js: AI plan steps for the idea window.
   The server reads the idea and suggests steps, with a time only when the text gives one.
   Nothing is added until you accept it. Works alongside the plan helper in assistant.js. */
(() => {
  'use strict';

  const ENDPOINT = '/api/assist';
  let lastOpenId = '';
  let state = { id: null, steps: [], busy: false, error: '' };

  const pad = (n) => String(n).padStart(2, '0');
  const stampLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const uid = () => Math.random().toString(36).slice(2, 10);
  const say = (message, kind = 'ok', icon = '🗺️') => { if (window.hiveToast) window.hiveToast(message, { kind, icon }); };

  function fmtWhen(v) {
    const d = v instanceof Date ? v : new Date(v);
    if (window.hiveKit && window.hiveKit.formatStamp) return window.hiveKit.formatStamp(d);
    return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

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

  function assistOf(idea) {
    if (!idea.assist) idea.assist = { answers: {}, skipped: [], notes: [], chat: [], declined: [], confirmed: false };
    if (!idea.assist.declined) idea.assist.declined = [];
    return idea.assist;
  }

  function ideaText(idea) {
    const a = idea.assist || {};
    const answers = Object.entries(a.answers || {}).map(([k, v]) => `${k}: ${v}`);
    return [
      idea.title ? `Title: ${idea.title}` : '',
      idea.body || '',
      ...(a.notes || []),
      ...answers
    ].filter(Boolean).join('\n\n').trim();
  }

  // Reads a clock time from the AI's time field first, then from the step text.
  function whenOf(step) {
    for (const src of [step.time, step.text]) {
      if (!src) continue;
      try {
        const r = window.hiveKit && window.hiveKit.parseWhen(src, new Date());
        if (r && r.found && r.hasTime) return stampLocal(r.when instanceof Date ? r.when : new Date(r.when));
      } catch (e) { console.warn('[hive ai-plan] time read', e); }
    }
    return '';
  }

  async function askAI(idea) {
    const prompt = ideaText(idea);
    if (!prompt) {
      state.error = 'Write a title or some text in the idea first.';
      render();
      return;
    }
    state.busy = true;
    state.error = '';
    render();

    let steps = [];
    let error = '';
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode: 'plan' })
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(data.steps)) steps = data.steps;
      else error = data.error || 'The AI is unavailable right now. The plan helper above still works.';
    } catch (e) {
      error = 'Could not reach the AI. Check your connection. The plan helper above still works.';
    }

    if (state.id !== idea.id) return; // the user moved to another idea while waiting

    const taken = new Set((idea.tasks || []).map((t) => norm(t.text)));
    const declined = (idea.assist && idea.assist.declined) || [];
    const list = [];
    for (const s of steps) {
      const text = String(s.text || '').trim().slice(0, 90);
      const key = norm(text);
      if (!key || taken.has(key) || declined.includes(key) || list.some((x) => x.key === key)) continue;
      const time = s.time ? String(s.time).trim().slice(0, 40) : '';
      list.push({ key, text, time, when: whenOf({ text, time }) });
    }
    state.steps = list.slice(0, 6);
    state.busy = false;
    state.error = error || (list.length
      ? ''
      : 'Everything the AI suggested is already in your plan. Try again later, or add your own step.');
    render();
  }

  function makeTask(s) {
    const t = { id: uid(), text: s.text, done: false, mins: 30 };
    if (s.when) t.scheduled = s.when;
    return t;
  }

  function accept(idea, key) {
    const s = state.steps.find((x) => x.key === key);
    if (!s) return;
    idea.tasks = idea.tasks || [];
    idea.tasks.push(makeTask(s));
    state.steps = state.steps.filter((x) => x.key !== key);
    done(idea, s.when ? `Added. I'll remind you at ${fmtWhen(s.when)}.` : 'Added to your plan.');
  }

  function decline(idea, key) {
    const a = assistOf(idea);
    if (!a.declined.includes(key)) a.declined.push(key);
    state.steps = state.steps.filter((x) => x.key !== key);
    persist();
    render();
  }

  function acceptAll(idea) {
    const list = state.steps;
    if (!list.length) return;
    idea.tasks = idea.tasks || [];
    list.forEach((s) => idea.tasks.push(makeTask(s)));
    state.steps = [];
    done(idea, `Added ${list.length} step${list.length === 1 ? '' : 's'} to your plan.`);
  }

  // Saves, redraws this panel, and reopens the idea so the plan list updates.
  function done(idea, msg) {
    persist();
    render();
    say(msg, 'ok', '🗺️');
    const card = document.querySelector(`[data-open="${CSS.escape(idea.id)}"]`);
    if (card) card.click();
  }

  function writeState(data) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('hive', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('kv', 'readwrite');
        const store = tx.objectStore('kv');
        if (store.keyPath) store.put(data); else store.put(data, 'state');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function persist() {
    const s = window.hiveLatest;
    if (!s) return;
    try { await writeState(s); } catch (e) { console.warn('[hive ai-plan] save failed', e); }
    window.dispatchEvent(new Event('hive:saved'));
  }

  function render() {
    const sec = document.getElementById('hvAiPlan');
    if (!sec) return;
    const n = state.steps.length;
    sec.innerHTML = `
      <div class="hv-card">
        <div class="hv-head">
          <span class="hv-bee">✨</span>
          <div><b>AI plan</b>
            <div class="hv-sub">The AI reads your idea and suggests steps. You decide which ones stay.</div>
          </div>
        </div>
        <details class="hv-why">
          <summary>How the AI planned this</summary>
          <p>It reads your title, your text, the answers you gave and our chat. A step gets a time only when the idea gives one. Nothing is added until you tap Accept. Accepted steps join your plan with 30 minutes, and a step with a time gets a reminder.</p>
        </details>
        <div class="hv-row">
          <button class="btn" data-aip="ask"${state.busy ? ' disabled' : ''}>${state.busy ? '✨ Thinking…' : n ? '🔄 Ask again' : '✨ Suggest steps with AI'}</button>
          ${n ? `<button class="btn ghost" data-aip="all">Accept all ${n}</button>` : ''}
        </div>
        ${state.error ? `<p class="hv-sub">${esc(state.error)}</p>` : ''}
        <div class="hv-sugs">
          ${state.steps.map((s) => `
            <div class="hv-sug">
              <b>${esc(s.text)}</b>
              <div class="hv-chip">${s.when ? '🕒 ' + esc(fmtWhen(s.when)) : s.time ? '🗓️ ' + esc(s.time) : '⏳ no time yet'}</div>
              <div class="hv-sub">The AI read this from your idea.</div>
              <div class="hv-row">
                <button class="btn" data-aip="accept" data-key="${esc(s.key)}">Accept</button>
                <button class="btn ghost" data-aip="decline" data-key="${esc(s.key)}">Decline</button>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function onClick(e) {
    const b = e.target.closest('[data-aip]');
    if (!b) return;
    const idea = currentIdea();
    if (!idea || idea.id !== state.id) return;
    const act = b.dataset.aip;
    if (act === 'ask') return askAI(idea);
    if (act === 'accept') return accept(idea, b.dataset.key);
    if (act === 'decline') return decline(idea, b.dataset.key);
    if (act === 'all') return acceptAll(idea);
  }

  function mount() {
    const assist = document.getElementById('hvAssist');
    const idea = assist ? currentIdea() : null;
    if (!assist || !idea) return;
    const existing = document.getElementById('hvAiPlan');
    if (existing && existing.dataset.idea === idea.id) return;
    if (existing) existing.remove();
    if (state.id !== idea.id) state = { id: idea.id, steps: [], busy: false, error: '' };

    const sec = document.createElement('section');
    sec.id = 'hvAiPlan';
    sec.dataset.idea = idea.id;
    sec.style.marginTop = '12px';
    sec.addEventListener('click', onClick);
    assist.insertAdjacentElement('afterend', sec);
    render();
  }

  function watch() {
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; mount(); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('[data-open]');
    if (el && el.dataset.open) lastOpenId = el.dataset.open;
  }, true);

  mount();
  watch();
})();