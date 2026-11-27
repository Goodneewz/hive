/* Hive: places the assistant, chat and AI plan panels into the idea tiles.
   Assistant panels go to the Assistant tile. Plan panels go to the Plan tile. */
(function () {
  const WHERE = {
    hvAsk: 'assist',
    hvTalk: 'assist',
    hvAi: 'assist',
    hvAiPlan: 'plan',
    hvPlan: 'plan'
  };

  function place() {
    const body = document.getElementById('ideaBody');
    if (!body) return;

    const sections = {};
    body.querySelectorAll('[data-sec]').forEach(s => { sections[s.dataset.sec] = s; });
    if (!sections.assist || !sections.plan) return;

    Object.keys(WHERE).forEach(id => {
      const el = document.getElementById(id);
      const target = sections[WHERE[id]];
      if (!el || !target) return;
      if (el.parentElement === target) return;
      target.appendChild(el);
    });

    // The old wrapper is no longer needed once its panels have moved out.
    const wrap = document.getElementById('hvAssist');
    if (wrap && wrap.children.length === 0) wrap.style.display = 'none';
  }

  const body = document.getElementById('ideaBody');
  if (body) {
    new MutationObserver(place).observe(body, { childList: true, subtree: true });
  }
  place();
})();