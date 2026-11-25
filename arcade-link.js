/* arcade-link.js: connects the idea window to the new games, and makes Delete safe */
(() => {
  const TXT_GAME = /turn it into a game/i;

  function openPicker() {
    if (window.hiveArcade && typeof window.hiveArcade.open === 'function') {
      window.hiveArcade.open();
    }
  }

  function fixGameCard(body) {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!TXT_GAME.test(node.textContent)) continue;
      let c = node.parentElement;
      while (c && c !== body && !c.querySelector('select')) c = c.parentElement;
      if (!c || c === body || c.dataset.arcFixed) continue;
      c.dataset.arcFixed = '1';

      // Hide the old game dropdown and its Play button
      const sel = c.querySelector('select');
      const row = sel.parentElement && sel.parentElement !== c ? sel.parentElement : sel;
      row.style.display = 'none';
      [...c.querySelectorAll('button')].forEach(b => {
        if (/^\s*▶?\s*Play\s*$/.test(b.textContent)) b.style.display = 'none';
      });

      // Replace the "Recommended: ..." line
      const rec = [...c.querySelectorAll('*')].filter(e =>
        /^\s*Recommended:/.test(e.textContent) &&
        ![...e.children].some(k => /^\s*Recommended:/.test(k.textContent))
      )[0];
      if (rec) rec.innerHTML = 'Nine thinking games made from this idea. Pick one in the picker.';

      // Add the one button that opens the new games
      const btn = document.createElement('button');
      btn.textContent = '🎮 Choose a thinking game';
      btn.dataset.arcOpen = '1';
      btn.style.cssText =
        'width:100%;margin-top:10px;padding:12px 16px;border:0;border-radius:12px;' +
        'background:#ffb800;color:#070d1a;font-weight:700;font-size:15px;cursor:pointer;';
      c.appendChild(btn);
    }
  }

  function fixDelete(body) {
    body.querySelectorAll('button').forEach(b => {
      if (b.dataset.arcDelete) return;
      if (!/^\s*(🗑\s*)?Delete idea\s*$/i.test(b.textContent)) return;
      b.dataset.arcDelete = '1';
      b.style.cssText =
        'background:none;border:0;color:#8b97b5;font-size:12px;cursor:pointer;' +
        'text-decoration:underline;padding:6px;';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'text-align:center;margin-top:22px;';
      wrap.appendChild(b);
      body.appendChild(wrap);
    });
  }

  // Open the new picker instead of the old game menu
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('#ideaBody [data-play], #ideaBody [data-arc-open]');
    if (!t) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openPicker();
  }, true);

  // Ask before deleting; cancel stops the delete
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-arc-delete]');
    if (!b) return;
    if (!window.confirm('Delete this idea for good? It cannot be undone.')) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  function run() {
    const body = document.getElementById('ideaBody');
    if (!body) return;
    fixGameCard(body);
    fixDelete(body);
  }

  const body = document.getElementById('ideaBody');
  if (body) new MutationObserver(run).observe(body, { childList: true, subtree: true });
  run();
})();