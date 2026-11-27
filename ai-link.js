(() => {
  'use strict';
  const ENDPOINT = '/api/assist';
  const STARTERS = [
    ['❓ Ask me a question', 'Ask me one creative question about my idea.'],
    ['📝 Summarise', 'Summarise my idea in a few sentences.'],
    ['🗺️ Suggest steps', 'Suggest the steps I can take next.']
  ];
  let chat = { key: null, messages: [], busy: false };

  function field(sel) {
    const el = document.querySelector(sel);
    return el ? String(el.value || el.textContent || '').trim() : '';
  }

  function ideaText() {
    const title = field('#eTitle');
    const body = field('#eBody');
    return `Title: ${title}\n\n${body}`.trim();
  }

  function hasIdea() {
    return !!(field('#eTitle') || field('#eBody'));
  }

  function injectCss() {
    if (document.getElementById('hvAiCss')) return;
    const style = document.createElement('style');
    style.id = 'hvAiCss';
    style.textContent = `
.hv-ai{margin-top:16px;padding:12px;border:1px solid var(--line,#22304a);border-radius:14px;background:var(--chip,#1d2a45)}
.hv-ai-head{font-weight:700;margin-bottom:8px;color:var(--text,#eef2ff)}
.hv-ai-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.hv-log{max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 2px;margin-bottom:10px}
.hv-hint{color:var(--muted,#8b97b5);font-size:13px;line-height:1.5;text-align:center;padding:8px}
.hv-msg{max-width:85%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;animation:hvIn .25s ease both}
.hv-msg.me{align-self:flex-end;background:var(--accent,#ffb800);color:#1a1200;border-bottom-right-radius:4px}
.hv-msg.ai{align-self:flex-start;background:var(--panel,#111b2e);color:var(--text,#eef2ff);border:1px solid var(--line,#22304a);border-bottom-left-radius:4px}
.hv-msg.err{color:var(--muted,#8b97b5);font-style:italic}
.hv-msg.thinking{color:var(--muted,#8b97b5)}
.hv-inp-row{display:flex;gap:8px;align-items:flex-end}
.hv-inp{flex:1;min-height:42px;max-height:120px;resize:vertical;background:var(--panel,#111b2e);color:var(--text,#eef2ff);border:1px solid var(--line,#22304a);border-radius:12px;padding:10px 12px;font:inherit;font-size:14px}
.hv-inp:focus{outline:none;border-color:var(--accent,#ffb800)}
.hv-send{background:var(--accent,#ffb800);color:#1a1200;border:0;border-radius:12px;padding:10px 16px;font-weight:700;cursor:pointer}
.hv-send:disabled{opacity:.5;cursor:default}
.hv-clear{background:none;border:0;color:var(--muted,#8b97b5);font-size:12px;cursor:pointer;margin-top:8px;text-decoration:underline}
@keyframes hvIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
`;
    document.head.appendChild(style);
  }

  function render(wrap) {
    const log = wrap.querySelector('.hv-log');
    log.textContent = '';
    if (chat.messages.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'hv-hint';
      hint.textContent = 'Start with a button, or type below. I read your idea first, then talk it through with you. Correct me any time.';
      log.appendChild(hint);
    }
    chat.messages.forEach(m => {
      const d = document.createElement('div');
      d.className = 'hv-msg ' + (m.role === 'user' ? 'me' : 'ai') + (m.err ? ' err' : '');
      d.textContent = m.text;
      log.appendChild(d);
    });
    if (chat.busy) {
      const t = document.createElement('div');
      t.className = 'hv-msg ai thinking';
      t.textContent = '✨ Thinking…';
      log.appendChild(t);
    }
    log.scrollTop = log.scrollHeight;
    wrap.querySelector('.hv-send').disabled = chat.busy;
  }

  async function send(text, wrap) {
    const clean = String(text || '').trim();
    if (!clean || chat.busy) return;
    if (!hasIdea()) {
      chat.messages.push({ role: 'assistant', text: 'Write a title or some text in the idea first, so I have something to talk about.', err: true });
      render(wrap);
      return;
    }
    chat.messages.push({ role: 'user', text: clean });
    chat.busy = true;
    render(wrap);

    const history = chat.messages
      .filter(m => !m.err)
      .map(m => ({ role: m.role, text: m.text }));

    let reply = '';
    let failed = false;
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: ideaText(), messages: history })
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.text) {
        reply = data.text;
      } else {
        failed = true;
        reply = (data.error || 'The assistant is unavailable right now.') + ' The built-in helper below still works.';
      }
    } catch (e) {
      failed = true;
      reply = 'Could not reach the assistant. Check your connection. The built-in helper below still works.';
    }

    chat.messages.push({ role: 'assistant', text: reply, err: failed });
    chat.busy = false;
    render(wrap);
    if (!failed) wrap.querySelector('.hv-inp').focus();
  }

  function mount() {
    const body = document.getElementById('ideaBody');
    if (!body || document.getElementById('hvAi')) return;
    injectCss();

    const key = field('#eTitle') || '(untitled)';
    if (chat.key !== key) chat = { key, messages: [], busy: false };

    const wrap = document.createElement('div');
    wrap.id = 'hvAi';
    wrap.className = 'hv-ai';

    const head = document.createElement('div');
    head.className = 'hv-ai-head';
    head.textContent = '✨ AI helper';

    const row = document.createElement('div');
    row.className = 'hv-ai-row';
    STARTERS.forEach(([label, prompt]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'arc-btn';
      b.textContent = label;
      b.addEventListener('click', () => send(prompt, wrap));
      row.appendChild(b);
    });

    const log = document.createElement('div');
    log.className = 'hv-log';

    const inputRow = document.createElement('div');
    inputRow.className = 'hv-inp-row';

    const input = document.createElement('textarea');
    input.className = 'hv-inp';
    input.rows = 1;
    input.placeholder = 'Answer, correct me, or ask something…';
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const v = input.value;
        input.value = '';
        send(v, wrap);
      }
    });

    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'hv-send';
    sendBtn.textContent = 'Send';
    sendBtn.addEventListener('click', () => {
      const v = input.value;
      input.value = '';
      send(v, wrap);
    });

    inputRow.append(input, sendBtn);

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'hv-clear';
    clear.textContent = 'Clear chat';
    clear.addEventListener('click', () => {
      chat.messages = [];
      render(wrap);
    });

    wrap.append(head, row, log, inputRow, clear);
    body.appendChild(wrap);
    render(wrap);
  }

  mount();
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
})();