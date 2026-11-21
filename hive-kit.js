/* hive-kit.js — shared helpers for Hive.
   parseWhen / planFromText : read times and dates from what you write
   dateOf / formatStamp      : turn saved dates into readable stamps
   matchIdea                 : search by keyword, date and time
   toast                     : friendly pop-up messages
   Nothing on the page changes until toast() is first called. */
(() => {
  'use strict';

  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const PART_HOUR = { morning: 9, noon: 12, afternoon: 14, evening: 18, tonight: 20, night: 20 };
  const ICON = { ok: '🐝', info: '💡', warn: '⚠️', done: '🎉' };

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cut = (str, part) => (part ? str.replace(new RegExp(esc(part), 'i'), ' ') : str);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  /* ---------- dates ---------- */
  function dateOf(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v === 'number') return new Date(v > 1e12 ? v : v * 1000);
    if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate(); // Firestore Timestamp
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }

  function formatStamp(v) {
    const d = dateOf(v);
    if (!d) return '';
    return d.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }

  /* ---------- reading times from plain writing ----------
     Understands: "in 20 minutes", "in 2 hours", "in 3 days", "today", "tomorrow",
     "friday", "next monday", "3pm", "3:30 pm", "at 15:00", "morning", "noon", "evening", "tonight".
     Returns the time and the sentence with the time words removed. */
  function parseWhen(text, now = new Date()) {
    let rest = String(text || '');
    const base = new Date(now);
    const hits = [];
    let minutesAhead = null;
    let dayOffset = null;
    let hour = null;
    let minute = 0;

    const hit = re => {
      const m = rest.match(re);
      if (!m) return null;
      hits.push(m[0]);
      rest = cut(rest, m[0]);
      return m;
    };

    let m = hit(/\bin\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\b/i);
    if (m) {
      const n = Number(m[1]);
      const unit = m[2][0].toLowerCase();
      if (unit === 'm') minutesAhead = n;
      else if (unit === 'h') minutesAhead = n * 60;
      else dayOffset = n;
    }

    if (hit(/\btomorrow\b/i)) dayOffset = 1;
    else if (hit(/\btoday\b/i)) dayOffset = 0;

    m = hit(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (m) {
      let diff = (DAYS.indexOf(m[2].toLowerCase()) - base.getDay() + 7) % 7;
      if (diff === 0 && m[1]) diff = 7;
      dayOffset = diff;
    }

    m = hit(/\b(morning|afternoon|evening|tonight|night|noon)\b/i);
    if (m) hour = PART_HOUR[m[1].toLowerCase()];

    m = hit(/\b(?:at|by)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (m) {
      hour = Number(m[1]) % 12 + (m[3].toLowerCase() === 'pm' ? 12 : 0);
      minute = m[2] ? Number(m[2]) : 0;
    } else {
      m = hit(/\b(?:at|by)\s+(\d{1,2}):(\d{2})\b/i);
      if (m && Number(m[1]) < 24 && Number(m[2]) < 60) {
        hour = Number(m[1]);
        minute = Number(m[2]);
      }
    }

    const cleaned = rest
      .replace(/\s+/g, ' ')
      .replace(/^\s*(on|at|by|for|to)\s+/i, '')
      .replace(/\s+(on|at|by|for|to)\s*$/i, '')
      .trim();

    const found = minutesAhead !== null || dayOffset !== null || hour !== null;
    if (!found) return { found: false, when: null, hasTime: false, cleaned, hits };

    let when;
    let hasTime = false;
    if (minutesAhead !== null) {
      when = new Date(base.getTime() + minutesAhead * 60000);
      hasTime = true;
    } else {
      when = new Date(base);
      when.setDate(when.getDate() + (dayOffset || 0));
      if (hour !== null) {
        when.setHours(hour, minute, 0, 0);
        hasTime = true;
        // "at 3pm" said after 3pm means tomorrow at 3pm, unless a day was given.
        if (dayOffset === null && when <= base) when.setDate(when.getDate() + 1);
      } else {
        when.setHours(9, 0, 0, 0); // a day with no time: suggest 9:00, user can change it
      }
    }
    return { found: true, when, hasTime, cleaned, hits };
  }

  // Splits a brain dump into steps, reading a time for each one.
  function planFromText(text, now = new Date()) {
    return String(text || '')
      .split(/\n|;|\.\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 1)
      .map(line => {
        const r = parseWhen(line, now);
        return { text: r.cleaned || line, when: r.when, hasTime: r.hasTime, source: line };
      });
  }

  /* ---------- search ---------- */
  function textOf(obj, out = []) {
    if (obj == null) return out;
    if (typeof obj === 'string') {
      if (!obj.startsWith('data:')) out.push(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach(v => textOf(v, out));
    } else if (typeof obj === 'object') {
      Object.values(obj).forEach(v => textOf(v, out));
    }
    return out;
  }

  // opts: { q: 'keywords', from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', time: 'HH:MM' }
  function matchIdea(idea, opts = {}) {
    const q = (opts.q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (q.length) {
      const hay = textOf(idea).join(' ').toLowerCase();
      if (!q.every(w => hay.includes(w))) return false;
    }
    if (opts.from || opts.to || opts.time) {
      const when = dateOf(idea.created ?? idea.createdAt ?? idea.updated ?? idea.updatedAt);
      if (!when) return false;
      if (opts.from && ymd(when) < opts.from) return false;
      if (opts.to && ymd(when) > opts.to) return false;
      if (opts.time && when.getHours() !== Number(opts.time.split(':')[0])) return false;
    }
    return true;
  }

  /* ---------- friendly pop-ups ---------- */
  const CSS = `
.hk-wrap{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:1200;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:min(92vw,420px)}
.hk-toast{pointer-events:auto;width:100%;box-sizing:border-box;padding:12px 16px;border-radius:14px;background:#0F1B2E;color:#F4EFD8;border:1px solid rgba(255,184,0,.4);box-shadow:0 10px 30px rgba(0,0,0,.45);font-weight:600;animation:hk-in .35s cubic-bezier(.2,.8,.2,1);transition:opacity .3s,transform .3s}
.hk-kind-done{border-color:#4ADE80}
.hk-kind-warn{border-color:#FF9A8B}
.hk-out{opacity:0;transform:translateY(8px)}
@keyframes hk-in{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.hk-toast{animation:none}}`;

  let wrap = null;
  function toast(message, opts = {}) {
    const kind = opts.kind || 'ok';
    if (!wrap) {
      const style = document.createElement('style');
      style.textContent = CSS;
      document.head.append(style);
      wrap = document.createElement('div');
      wrap.className = 'hk-wrap';
      wrap.setAttribute('role', 'status');
      wrap.setAttribute('aria-live', 'polite');
      document.body.append(wrap);
    }
    const el = document.createElement('div');
    el.className = 'hk-toast hk-kind-' + kind;
    el.textContent = (opts.icon || ICON[kind] || '🐝') + ' ' + message;
    wrap.append(el);
    while (wrap.children.length > 3) wrap.firstChild.remove();
    setTimeout(() => {
      el.classList.add('hk-out');
      setTimeout(() => el.remove(), 300);
    }, opts.ms || 2800);
  }

  window.hiveKit = { parseWhen, planFromText, dateOf, formatStamp, matchIdea, toast };
  window.hiveToast = toast;
})();