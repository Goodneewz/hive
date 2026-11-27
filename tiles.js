/* Hive: idea tiles. Keeps the open tile, places the panels,
   and sends "Play it" to the arcade game picker, not Mind Lab. */
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
  let bypass = false;

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

  // Opens the nine-game picker for this idea.
  function openPicker() {
    if (window.hiveArcade && typeof window.hiveArcade.open === 'function') {
      window.hiveArcade.open(typeof currentId !== 'undefined' ? currentId : undefined);
      return;
    }
    const btn = [...document.querySelectorAll('#ideaBody button')]
      .find(x => /Choose a thinking game/.test(x.textContent));
    if (btn) {
      bypass = true;
      btn.click();
      bypass = false;
    }
  }

  // Runs first, so Mind Lab and other listeners never see these taps.
  function onClick(e) {
    if (bypass) return;
    const t = e.target;
    if (!t || !t.closest) return;

    const tile = t.closest('#ideaBody [data-tile]');
    const back = t.closest('#ideaBody [data-back]');
    const btn = t.closest('#ideaBody button');
    const pick = !!btn && /Choose a thinking game/.test(btn.textContent);

    if (!tile && !back && !pick) return;

    e.stopImmediatePropagation();
    e.preventDefault();

    if (back) {
      openSec = '';
      apply();
      return;
    }

    if (pick || tile.dataset.tile === 'game') {
      openPicker();
      return;
    }

    openSec = tile.dataset.tile;
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