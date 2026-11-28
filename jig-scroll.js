/* jig-scroll.js: while you drag a jigsaw piece near the top or bottom
   of the window, the page scrolls by itself. No buttons. */
(function () {
  var dragging = false;
  var raf = 0;
  var lastY = 0;
  var scroller = null;

  // A box we can scroll: it has a scrollbar, or is clipped and can be unclipped.
  function findScroller(start) {
    var el = start;
    while (el && el !== document.body && el !== document.documentElement) {
      var cs = getComputedStyle(el);
      var oy = cs.overflowY;
      if (el.scrollHeight > el.clientHeight + 2) {
        if (oy === 'auto' || oy === 'scroll') return el;
        if (oy === 'hidden') {
          el.style.overflowY = 'auto';
          return el;
        }
      }
      el = el.parentElement;
    }
    return null;
  }

  function scrollPage(amount) {
    if (scroller) scroller.scrollTop += amount;
    else window.scrollBy(0, amount);
  }

  // Which way to scroll for the pointer's height on screen (0 = no scroll).
  function directionFor(y) {
    var edge = 110;
    if (y < edge) return -1;
    if (y > window.innerHeight - edge) return 1;
    return 0;
  }

  function loop() {
    if (!dragging) { raf = 0; return; }
    var d = directionFor(lastY);
    if (d) scrollPage(d * 12);
    raf = requestAnimationFrame(loop);
  }

  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('.arc-jig-p')) {
      dragging = true;
      lastY = e.clientY;
      scroller = findScroller(t);
      if (!raf) raf = requestAnimationFrame(loop);
    }
  }, true);

  document.addEventListener('pointermove', function (e) {
    if (dragging) lastY = e.clientY;
  }, true);

  function stop() { dragging = false; }
  window.addEventListener('pointerup', stop, true);
  window.addEventListener('pointercancel', stop, true);
})();