/* jig-scroll.js: lets the jigsaw screen scroll. Adds up and down
   buttons, and scrolls automatically when a dragged piece nears an edge. */
(function () {
  var dragging = false, dir = 0, raf = 0, active = null, lastBoard = null;

  function jigBoard() { return document.querySelector('.arc-jig-board'); }

  // Make fixed or clipped boxes around the board scrollable.
  function unlock(board) {
    var el = board.parentElement;
    while (el && el !== document.documentElement) {
      var cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.overflowY === 'hidden' || cs.overflow === 'hidden') {
        el.style.overflowY = 'auto';
        el.style.maxHeight = '100vh';
        el.dataset.jigScroll = '1';
      }
      el = el.parentElement;
    }
    // The nearest box marked above is the one we scroll.
    el = board.parentElement;
    active = null;
    while (el && el !== document.documentElement) {
      if (el.dataset && el.dataset.jigScroll) { active = el; break; }
      el = el.parentElement;
    }
  }

  function doScroll(amount) {
    if (active) active.scrollTop += amount;
    else window.scrollBy(0, amount);
  }

  function edgeDir(y) {
    var top = 0, bottom = window.innerHeight;
    if (active) {
      var r = active.getBoundingClientRect();
      top = Math.max(r.top, 0);
      bottom = Math.min(r.bottom, window.innerHeight);
    }
    var edge = 90;
    if (y < top + edge) return -1;
    if (y > bottom - edge) return 1;
    return 0;
  }

  function loop() {
    if (!dragging || !dir) { raf = 0; return; }
    doScroll(dir * 14);
    raf = requestAnimationFrame(loop);
  }

  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('.arc-jig-p')) dragging = true;
  }, true);

  document.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    dir = edgeDir(e.clientY);
    if (dir && !raf) raf = requestAnimationFrame(loop);
  }, true);

  function stop() { dragging = false; dir = 0; }
  window.addEventListener('pointerup', stop, true);
  window.addEventListener('pointercancel', stop, true);

  // Floating up and down buttons, shown only while a jigsaw board exists.
  var bar = document.createElement('div');
  bar.id = 'hvJigBar';
  bar.style.cssText = 'position:fixed;right:10px;bottom:90px;z-index:100000;display:none;flex-direction:column;gap:8px;';
  bar.innerHTML =
    '<button type="button" style="font-size:20px;width:44px;height:44px;border-radius:22px;border:none;background:#ffb800;cursor:pointer;">⬆️</button>' +
    '<button type="button" style="font-size:20px;width:44px;height:44px;border-radius:22px;border:none;background:#ffb800;cursor:pointer;">⬇️</button>';
  document.body.appendChild(bar);
  bar.children[0].addEventListener('click', function () { doScroll(-200); });
  bar.children[1].addEventListener('click', function () { doScroll(200); });

  var mo = new MutationObserver(function () {
    var b = jigBoard();
    bar.style.display = b ? 'flex' : 'none';
    if (b && b !== lastBoard) {
      lastBoard = b;
      unlock(b);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();