/* jig-scroll.js: while you drag a jigsaw piece near the top or bottom
   of the window, every scrollable box around it scrolls by itself,
   and the piece stays under your cursor. */
(function () {
  var TF = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/;
  var dragging = false, raf = 0, lastY = 0, shiftY = 0;
  var wrap = null, tgt = null, scrollers = [];

  // Every box around the piece that has more content than it shows.
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
    return d < 0 ? el.scrollTop > 0
      : el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  }

  function moveBy(el, px) {
    if (el === window) window.scrollBy(0, px);
    else el.scrollTop += px;
  }

  // The element that carries the piece's movement (translate).
  function pickEl() {
    var c = [wrap, wrap && wrap.firstElementChild, tgt];
    for (var i = 0; i < c.length; i++) {
      if (c[i] && c[i].style && TF.test(c[i].style.transform || '')) return c[i];
    }
    return null;
  }

  function nudge(el, dy) {
    var m = TF.exec(el.style.transform);
    el.style.transform = 'translate(' + m[1] + 'px, ' + (parseFloat(m[2]) + dy) + 'px)';
  }

  function tick() {
    if (!dragging) { raf = 0; return; }
    var dir = lastY < 120 ? -1 : (lastY > window.innerHeight - 120 ? 1 : 0);
    if (dir) {
      var el = pickEl() || wrap;
      var before = el.getBoundingClientRect().top;
      for (var i = 0; i < scrollers.length; i++) {
        if (canMove(scrollers[i], dir)) moveBy(scrollers[i], dir * 16);
      }
      var delta = el.getBoundingClientRect().top - before;
      var moving = pickEl();
      if (delta && moving) {
        shiftY -= delta;
        nudge(moving, -delta);
      }
    }
    raf = requestAnimationFrame(tick);
  }

  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    var w = t && t.closest ? t.closest('.arc-jig-p') : null;
    if (!w) return;
    dragging = true; wrap = w; tgt = t; shiftY = 0; lastY = e.clientY;
    scrollers = findScrollers(w);
    if (!raf) raf = requestAnimationFrame(tick);
  }, true);

  window.addEventListener('pointermove', function (e) {
    if (dragging) lastY = e.clientY;
  }, true);

  // After the game moves the piece, add back the scroll correction.
  window.addEventListener('pointermove', function () {
    if (!dragging || !shiftY) return;
    var el = pickEl();
    if (el) nudge(el, shiftY);
  });

  function stop() { dragging = false; shiftY = 0; }
  window.addEventListener('pointerup', stop, true);
  window.addEventListener('pointercancel', stop, true);
})();