/* Hive: idea tiles. Keeps the open tile when the idea redraws,
   places the panels, and sends "Play it" to the game picker. */
(function () {
  const WHERE = {
    hvAsk: 'assist',
    hvTalk: 'assist',
    hvAi: 'assist',
    hvAiPlan: 'plan',
    hvPlan: 'plan'
  };

  let openSec = '';
  let openFor = null;

  const body = () => document.getElementById('ideaBody');

  // Shows the home tiles, or one section if a tile is open.
  function apply() {
    const b = body();
    if (!b) return;
    const home = b.querySelector('#hvHome');
    if (home) home.style.display = openSec ? 'none' : '';
    b.querySelectorAll('[data-sec]').forEach(s => {
      s.style.display = s.dataset.sec === openSec ? 'block' : 'none';
    });
  }

  // Moves the assistant and AI plan panels into their tiles.
  function place() {
    const b = body();
    if (!b) return;

    const id = typeof currentId !== 'undefined' ? currentId : null;
    if (id !== openFor) {
      openFor = id;
      openSec = '';
    }

    const sections = {};
    b.querySelectorAll('[data-sec]').forEach(s => { sections[s.dataset.sec] = s; });
    if (!sections.assist || !sections.plan) return;

    Object.keys(WHERE).forEach(pid => {
      const el = document.getElementById(pid);
      const target = sections[WHERE[pid]];
      if (!el || !target) return;
      if (el.parentElement === target) return;
      target.appendChild(el);
    });

    const wrap = document.getElementById('hvAssist');
    if (wrap && wrap.children.length === 0) wrap.style.display = 'none';

    apply();
  }

  // Opens the game picker from the Play it tile.
  function openPicker() {
    const btn = [...document.querySelectorAll('#ideaBody button')]
      .find(x => /Choose a thinking game/.test(x.textContent));
    if (btn) { btn.click(); return; }
    if (window.hiveArcade && window.hiveArcade.open && typeof currentId !== 'undefined') {
      window.hiveArcade.open(currentId);
    }
  }

  // Handles tile and Back taps before the idea's own handlers, so the choice is remembered.
  function onClick(e) {
    if (!e.target || !e.target.closest) return;
    const tile = e.target.closest('#ideaBody [data-tile]');
    const back = e.target.closest('#ideaBody [data-back]');
    if (!tile && !back) return;

    e.stopPropagation();
    e.preventDefault();

    if (back) {
      openSec = '';
      apply();
      return;
    }

    const name = tile.dataset.tile;
    if (name === 'game') {
      openPicker();
      return;
    }
    openSec = name;
    apply();
    const b = body();
    if (b) b.scrollIntoView({ block: 'start' });
  }

  document.addEventListener('click', onClick, true);

  const b = body();
  if (b) {
    new MutationObserver(place).observe(b, { childList: true, subtree: true });
  }
  place();
})();