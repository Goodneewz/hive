(() => {
  'use strict';
  const ENDPOINT = '/api/assist';
  const TASKS = [
    ['questions', '❓ Ask me questions'],
    ['summary', '📝 Summarise'],
    ['plan', '🗺️ Suggest steps']
  ];

  function fieldText(sel) {
    const el = document.querySelector(sel);
    return el ? String(el.value || el.textContent || '').trim() : '';
  }

  function buildPrompt() {
    const title = fieldText('#eTitle');
    const body = fieldText('#eBody');
    if (!title && !body) return '';
    return `Title: ${title}\n\n${body}`.trim();
  }

  async function ask(task, box) {
    const prompt = buildPrompt();
    if (!prompt) {
      box.textContent = 'Write a title or some text in the idea first, then ask again.';
      return;
    }
    box.textContent = '✨ Thinking…';
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, prompt })
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.text) {
        box.textContent = data.text;
        return;
      }
      box.textContent = (data.error || 'The assistant is unavailable right now.') +
        ' The built-in helper below still works.';
    } catch (e) {
      box.textContent = 'Could not reach the assistant. Check your connection. The built-in helper below still works.';
    }
  }

  function injectCss() {
    if (document.getElementById('hvAiCss')) return;
    const style = document.createElement('style');
    style.id = 'hvAiCss';
    style.textContent = `
.hv-ai{margin-top:16px;padding:12px;border:1px solid var(--line,#22304a);border-radius:14px;background:var(--chip,#1d2a45)}
.hv-ai-head{font-weight:700;margin-bottom:8px;color:var(--text,#eef2ff)}
.hv-ai-row{display:flex;flex-wrap:wrap;gap:8px}
.hv-ai-box{margin-top:10px;white-space:pre-wrap;color:var(--muted,#8b97b5);font-size:14px;line-height:1.5;min-height:24px}
`;
    document.head.appendChild(style);
  }

  function mount() {
    const body = document.getElementById('ideaBody');
    if (!body || document.getElementById('hvAi')) return;
    injectCss();

    const wrap = document.createElement('div');
    wrap.id = 'hvAi';
    wrap.className = 'hv-ai';

    const head = document.createElement('div');
    head.className = 'hv-ai-head';
    head.textContent = '✨ AI helper';

    const row = document.createElement('div');
    row.className = 'hv-ai-row';

    const box = document.createElement('div');
    box.className = 'hv-ai-box';
    box.textContent = 'Pick one. The AI reads your title and text.';

    TASKS.forEach(([task, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'arc-btn';
      b.textContent = label;
      b.addEventListener('click', () => ask(task, box));
      row.appendChild(b);
    });

    wrap.append(head, row, box);
    body.appendChild(wrap);
  }

  mount();
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
})();