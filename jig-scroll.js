/* jig-scroll.js: lets the jigsaw screen scroll, and scrolls it
   while you drag a piece near the top or bottom edge of the window. */
(function () {
  let dragging = false;
  let dir = 0;
  let raf = 0;

  function boardOf() {
    return document.querySelector('.arc-jig-board');
  }

  // Make the parent boxes of the jigsaw board scrollable.
  function makeScrollable(board) {
    let el = board.parentElement;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.overflowY === 'hidden' || cs.overflow === 'hidden') {
        el.style.overflowY = 'auto';
        el.style.maxHeight = '100vh';
        el.dataset.jigScroll = '1';
      }
      el = el.parentElement;
    }
  }

  function scrollerOf() {
    const b = boardOf();
    let el = b ? b.parentElement : null;
    while (el) {
      if (el.dataset && el.dataset.jigScroll) return el;
      el = el.parentElement;
    }
    return null;
  }

  function step() {
    if (!dragging || !dir) { raf = 0; return; }
    const s = scrollerOf();
    if (s) s.scrollTop += dir * 14;
    else window.scrollBy(0, dir * 14);
    raf = requestAnimationFrame(step);
  }

  // Start dragging when a piece is pressed.
  document.addEventListener('pointerdown', function (e) {
    const t = e.target;
    if (t && t.closest && t.closest('.arc-jig-p')) dragging = true;
  }, true);

  // Scroll while the pointer is near the top or bottom edge.
  document.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    const edge = 90;
    if (e.clientY < edge) dir = -1;
    else if (e.clientY > window.innerHeight - edge) dir = 1;
    else dir = 0;
    if (dir && !raf) raf = requestAnimationFrame(step);
  }, true);

  function stop() { dragging = false; dir = 0; }
  window.addEventListener('pointerup', stop, true);
  window.addEventListener('pointercancel', stop, true);

  // Set up the scrolling whenever a jigsaw board appears.
  const mo = new MutationObserver(function () {
    const b = boardOf();
    if (b && !b.dataset.jigFixed) {
      b.dataset.jigFixed = '1';
      makeScrollable(b);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();