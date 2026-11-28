/* jig-scroll.js: while you drag a jigsaw piece near the top or bottom
   of the window, the scrollable boxes scroll by themselves.
   It never moves the piece itself. */
(function () {
  var dragging = false, raf = 0, lastY = 0, scrollers = [];

  function findScrollers(start) {
    var list = [], el = start.parentElement;
    while (el && el !== document.documentElement) {
      var cs = getComputedStyle(el);
      if (el.scrollHeight > el.clientHeight + 2) {
        if (cs.overflowY === 'hidden' || cs.overflowY === 'clip') el.style.overflowY = 'auto';
        if (cs.overflowY !== 'visible') list.push(el);
      }
      el = el.parentElement;
    }
    list.push(window);
    return list;
  }

  function canMove(el, d) {
    if (el === window) {
      return d < 0 ? window.scrollY > 0
        : window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 1;
    }
    return d < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  }

  function tick() {
    if (!dragging) { raf = 0; return; }
    var dir = lastY < 120 ? -1 : (lastY > window.innerHeight - 120 ? 1 : 0);
    if (dir) {
      for (var i = 0; i < scrollers.length; i++) {
        var el = scrollers[i];
        if (!canMove(el, dir)) continue;
        if (el === window) window.scrollBy(0, dir * 12);
        else el.scrollTop += dir * 12;
      }
    }
    raf = requestAnimationFrame(tick);
  }

  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    var w = t && t.closest ? t.closest('.arc-jig-p') : null;
    if (!w) return;
    dragging = true; lastY = e.clientY;
    scrollers = findScrollers(w);
    if (!raf) raf = requestAnimationFrame(tick);
  }, true);

  window.addEventListener('pointermove', function (e) {
    if (dragging) lastY = e.clientY;
  }, true);

  function stop() { dragging = false; }
  window.addEventListener('pointerup', stop, true);
  window.addEventListener('pointercancel', stop, true);
})();