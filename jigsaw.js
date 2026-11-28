/* jigsaw.js: a real jigsaw in one file.
   - Correct pieces lock in their slot.
   - Wrong pieces stay where dropped and can be moved again.
   - Correctly joined pieces merge into a group that moves together.
   - The tray closes its gaps whenever a piece leaves it, and makes room when one returns.
   - Pieces follow the cursor, even while the page scrolls.
   - The picture shows big at first, then shrinks to a small view. */
(function () {
  var TOL = 0.45;
  var current = null;

  function hash(s) {
    var x = 5381;
    s = String(s || 'x');
    for (var i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0;
    return Math.abs(x) || 1;
  }

  function rnd(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(a, rand) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function parseMove(el) {
    var m = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el.style.transform || '');
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
  }

  function setMove(el, x, y) {
    el.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
  }

  // Scrollable boxes between a piece and the window.
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
    return list;
  }

  function canScroll(el, d) {
    if (el === window) {
      return d < 0 ? window.scrollY > 0
        : window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 1;
    }
    return d < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  }

  function scrollBy(el, px) {
    if (el === window) window.scrollBy(0, px);
    else el.scrollTop += px;
  }

  window.addEventListener('pointermove', function (e) { if (current) current.move(e); });
  window.addEventListener('pointerup', function () { if (current) current.up(); });
  window.addEventListener('pointercancel', function () { if (current) current.up(); });

  window.hvJigsaw = function (sess, h) {
    var pc = sess.cfg.pieces;
    var cols = 3, rows = 3;
    if (pc === '128' || pc === 128) { cols = 8; rows = 16; }
    else { cols = rows = Math.max(2, Math.min(8, parseInt(pc, 10) || 3)); }
    var N = cols * rows;
    var hasTimer = sess.cfg.timer === 'on';
    var showRef = (sess.cfg.ref || 'full') === 'full';

    var avail = Math.min(380, window.innerWidth - 80);
    var cap = cols >= 8 ? 46 : 120;
    var cell = Math.max(24, Math.min(cap, Math.floor(avail / cols)));
    var BW = cols * cell, BH = rows * cell;
    var pad = Math.round(cell * 0.3), pSize = cell + pad * 2;
    var bx = pad + 12, by = pad + 12;
    var worldW = Math.max(bx + BW + pad + 12, Math.min(560, window.innerWidth - 24));
    var pitch = pSize + 6;
    var trayCols = Math.max(1, Math.floor((worldW - 24) / pitch));
    var trayRows = Math.ceil(N / trayCols) + 2;
    var ty = by + BH + pad + 40;
    var worldH = ty + trayRows * pitch;

    var spots = [];
    for (var sr = 0; sr < trayRows; sr++) {
      for (var sc = 0; sc < trayCols; sc++) {
        spots.push({ x: 12 + sc * pitch, y: ty + sr * pitch });
      }
    }

    var pieces = [], placed = 0, mistakes = 0, elapsed = 0;
    var drag = null, syncOn = false, scrollRaf = 0;
    var msg, world, boardEl;

    function place(p) {
      p.el.style.left = p.x + 'px';
      p.el.style.top = p.y + 'px';
      p.el.style.transform = '';
    }
    function members(gid) {
      return pieces.filter(function (p) { return p.gid === gid; });
    }
    function pieceAt(rr, cc) {
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) return null;
      return pieces[rr * cols + cc];
    }
    function slotX(p) { return bx + p.c * cell - pad; }
    function slotY(p) { return by + p.r * cell - pad; }
    function near(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2) < cell * TOL; }
    function shiftGroup(G, dx, dy) {
      G.forEach(function (m) { m.x += dx; m.y += dy; place(m); });
    }
    function updateZ() {
      pieces.forEach(function (p) { p.el.style.zIndex = p.anchored ? 1 : 3; });
    }

    // Tray position, in tray grid order (used to keep the tray closed up).
    function trayKey(p) {
      var row = Math.max(0, Math.round((p.y - ty) / pitch));
      var col = Math.min(trayCols - 1, Math.max(0, Math.round((p.x - 12) / pitch)));
      return row * trayCols + col;
    }

    // Close every gap in the tray, and make room for returned pieces.
    function packTray() {
      var seen = {}, units = [];
      pieces.forEach(function (p) {
        if (!p.inTray || p.anchored || seen[p.gid]) return;
        seen[p.gid] = true;
        var G = members(p.gid);
        var best = G[0];
        G.forEach(function (m) { if (trayKey(m) < trayKey(best)) best = m; });
        units.push({ G: G, anchor: best, key: trayKey(best) });
      });
      units.sort(function (a, b) {
        return a.key - b.key || a.anchor.id - b.anchor.id;
      });
      units.forEach(function (u, i) {
        var s = spots[i];
        shiftGroup(u.G, s.x - u.anchor.x, s.y - u.anchor.y);
      });
    }

    function anchor(G) {
      G.forEach(function (m) {
        if (!m.anchored) placed++;
        m.x = slotX(m); m.y = slotY(m);
        m.anchored = true;
        m.inTray = false;
        place(m);
        m.el.style.cursor = 'default';
        m.el.classList.add('locked');
      });
      var slots = G.map(function (m) { return { x: m.x + pSize / 2, y: m.y + pSize / 2 }; });
      var gid = G[0].gid;
      pieces.slice().forEach(function (q) {
        if (q.anchored || q.gid === gid) return;
        var hit = slots.some(function (s) {
          return Math.hypot(q.x + pSize / 2 - s.x, q.y + pSize / 2 - s.y) < cell * 0.6;
        });
        if (hit) {
          // A piece covering a correct slot goes back to the tray.
          members(q.gid).forEach(function (m) { m.inTray = true; });
        }
      });
    }

    function settle(gid) {
      var G = members(gid), i, m, k;
      for (i = 0; i < G.length; i++) {
        m = G[i];
        var sx = slotX(m), sy = slotY(m);
        if (near(m.x, m.y, sx, sy)) {
          shiftGroup(G, sx - m.x, sy - m.y);
          anchor(G);
          return true;
        }
      }
      for (i = 0; i < G.length; i++) {
        m = G[i];
        var around = [pieceAt(m.r - 1, m.c), pieceAt(m.r + 1, m.c), pieceAt(m.r, m.c - 1), pieceAt(m.r, m.c + 1)];
        for (k = 0; k < around.length; k++) {
          var q = around[k];
          if (!q || q.gid === gid || q.anchored) continue;
          var ix = q.x + (m.c - q.c) * cell, iy = q.y + (m.r - q.r) * cell;
          if (near(m.x, m.y, ix, iy)) {
            shiftGroup(G, ix - m.x, iy - m.y);
            var target = q.gid;
            G.forEach(function (x) { x.gid = target; });
            settle(target);
            return true;
          }
        }
      }
      return false;
    }

    function finish() {
      drag = null;
      var pct = Math.max(40, 100 - mistakes * 4);
      h.endRound(sess, true, pct, [
        'All ' + N + ' jigsaw pieces assembled.',
        mistakes === 0 ? 'Flawless assembly! Zero misplacements.' : mistakes + ' wrong drop' + (mistakes === 1 ? '' : 's') + '.',
        hasTimer ? 'Finished in ' + h.mmss(elapsed) + '.' : 'Edge and corner pieces gave you the frame to build within.'
      ]);
    }

    function syncMembers() {
      if (!drag) return;
      var t = drag.leader.el.style.transform;
      members(drag.gid).forEach(function (m) {
        if (m !== drag.leader) m.el.style.transform = t;
      });
    }

    // Scroll the boxes near the window edges while dragging, and keep the
    // piece under the cursor by cancelling the movement the scroll causes.
    function autoScroll() {
      if (!drag) { scrollRaf = 0; return; }
      var H = window.innerHeight, y = drag.cy;
      var dir = y < 110 ? -1 : (y > H - 110 ? 1 : 0);
      if (dir) {
        var L = drag.leader.el;
        var before = L.getBoundingClientRect().top;
        for (var i = 0; i < drag.scrollers.length; i++) {
          if (canScroll(drag.scrollers[i], dir)) scrollBy(drag.scrollers[i], dir * 12);
        }
        var dy = L.getBoundingClientRect().top - before;
        if (dy) {
          var mv = parseMove(L);
          setMove(L, mv.x, mv.y - dy);
          syncMembers();
        }
      }
      scrollRaf = requestAnimationFrame(autoScroll);
    }

    function onMove(e) {
      if (!drag) return;
      var L = drag.leader, mv = parseMove(L.el);
      mv.x += e.clientX - drag.lx;
      mv.y += e.clientY - drag.ly;
      drag.lx = e.clientX; drag.ly = e.clientY;
      drag.cy = e.clientY;
      setMove(L.el, mv.x, mv.y);
      syncMembers();
    }

    function onUp() {
      if (!drag) return;
      var L = drag.leader, size = drag.size, mv = parseMove(L.el);
      members(drag.gid).forEach(function (m) {
        m.x += mv.x; m.y += mv.y; place(m);
      });
      drag = null;

      settle(L.gid);
      var now = members(L.gid), note;

      // Where the piece was let go decides whether it is in the tray.
      var inArea = (L.y + pSize / 2) > ty - pitch * 0.5;
      now.forEach(function (m) { m.inTray = !L.anchored && inArea; });

      if (L.anchored) {
        note = now.length > 1 ? '🔗 Locked in with its neighbours!' : '✅ Locked in. Nice placement.';
      } else if (now.length > size) {
        note = '🔗 Pieces joined. They move together now.';
      } else if (inArea) {
        note = '🧩 Back in the tray. Place it on the board when you are ready.';
      } else {
        var col = Math.floor((L.x + pad + cell / 2 - bx) / cell);
        var row = Math.floor((L.y + pad + cell / 2 - by) / cell);
        var onBoard = row >= 0 && col >= 0 && row < rows && col < cols;
        if (onBoard && (row !== L.r || col !== L.c)) {
          mistakes++;
          note = '❌ Not that spot. It stays where you dropped it. Move it to its right place.';
        } else if (onBoard) {
          note = '👀 Right area, but no match yet. Try a neighbouring piece.';
        } else {
          note = '🧩 Pieces you have not placed wait in the tray.';
        }
      }

      packTray();
      msg.textContent = note;
      updateZ();
      sess.hudRefresh();
      if (placed >= N && !sess.done) finish();
    }

    function bindDrag(p) {
      p.el.addEventListener('pointerdown', function (e) {
        if (sess.done || p.anchored) return;
        var G = members(p.gid);
        if (G.some(function (m) { return m.anchored; })) return;
        e.preventDefault();
        drag = {
          leader: p, gid: p.gid, size: G.length,
          lx: e.clientX, ly: e.clientY, cy: e.clientY,
          scrollers: findScrollers(p.el)
        };
        G.forEach(function (m) { m.el.style.zIndex = 4; });
        if (!scrollRaf) scrollRaf = requestAnimationFrame(autoScroll);
      });
    }

    function buildPreview(src) {
      var box = document.createElement('div');
      box.style.cssText = 'text-align:center;margin:0 0 8px;';
      var cv = document.createElement('canvas');
      cv.style.cssText = 'display:block;margin:0 auto 6px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.45);';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = 'font-size:13px;padding:4px 12px;border-radius:14px;border:none;background:#ffb800;cursor:pointer;';
      var big = Math.min(300, Math.max(160, window.innerWidth - 60));
      var small = 96;
      var mode = 'big';
      function draw() {
        var s = mode === 'big' ? big : small;
        cv.width = s; cv.height = s;
        cv.style.width = s + 'px'; cv.style.height = s + 'px';
        cv.getContext('2d').drawImage(src, 0, 0, s, s);
        btn.textContent = mode === 'big' ? '🔽 Make it small' : '🔼 Show it big';
      }
      btn.addEventListener('click', function () {
        mode = mode === 'big' ? 'small' : 'big';
        draw();
      });
      draw();
      box.appendChild(cv);
      box.appendChild(btn);
      setTimeout(function () {
        if (mode === 'big' && h.cur() === sess && !sess.done) { mode = 'small'; draw(); }
      }, 12000);
      return box;
    }

    function build(src) {
      var pic = document.createElement('canvas');
      pic.width = BW; pic.height = BH;
      pic.getContext('2d').drawImage(src, 0, 0, BW, BH);

      var rand = rnd(hash(sess.id));
      var Hh = [], Vv = [], r, c;
      for (r = 0; r < rows; r++) {
        Hh[r] = []; Vv[r] = [];
        for (c = 0; c < cols; c++) {
          Hh[r][c] = rand() < 0.5 ? 1 : -1;
          Vv[r][c] = rand() < 0.5 ? 1 : -1;
        }
      }

      function tabOf(rr, cc, side) {
        if (side === 'top') return rr === 0 ? 0 : -Vv[rr - 1][cc];
        if (side === 'right') return cc === cols - 1 ? 0 : Hh[rr][cc];
        if (side === 'bottom') return rr === rows - 1 ? 0 : Vv[rr][cc];
        return cc === 0 ? 0 : -Hh[rr][cc - 1];
      }

      function edge(g, ax, ay, ex, ey, t) {
        if (!t) { g.lineTo(ex, ey); return; }
        var dx = ex - ax, dy = ey - ay, len = Math.hypot(dx, dy);
        var nx = dy / len, ny = -dx / len, k = cell * 0.2 * t;
        var P = function (f, hgt) { return [ax + dx * f + nx * hgt, ay + dy * f + ny * hgt]; };
        var a = P(0.35, 0), c1 = P(0.35, k * 0.9), c2 = P(0.25, k * 1.3), m = P(0.5, k * 1.3);
        var c3 = P(0.75, k * 1.3), c4 = P(0.65, k * 0.9), b = P(0.65, 0);
        g.lineTo(a[0], a[1]);
        g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], m[0], m[1]);
        g.bezierCurveTo(c3[0], c3[1], c4[0], c4[1], b[0], b[1]);
        g.lineTo(ex, ey);
      }

      function outline(g, rr, cc) {
        var x0 = pad, y0 = pad, x1 = pad + cell, y1 = pad + cell;
        g.beginPath();
        g.moveTo(x0, y0);
        edge(g, x0, y0, x1, y0, tabOf(rr, cc, 'top'));
        edge(g, x1, y0, x1, y1, tabOf(rr, cc, 'right'));
        edge(g, x1, y1, x0, y1, tabOf(rr, cc, 'bottom'));
        edge(g, x0, y1, x0, y0, tabOf(rr, cc, 'left'));
        g.closePath();
      }

      function pieceCanvas(rr, cc) {
        var cv = document.createElement('canvas');
        cv.width = pSize; cv.height = pSize;
        cv.style.display = 'block';
        var g = cv.getContext('2d');
        outline(g, rr, cc);
        g.save();
        g.clip();
        g.drawImage(pic, pad - cc * cell, pad - rr * cell, BW, BH);
        g.restore();
        outline(g, rr, cc);
        g.lineWidth = 1.5;
        g.strokeStyle = 'rgba(10,20,40,0.7)';
        g.stroke();
        return cv;
      }

      var order = [];
      for (var i = 0; i < N; i++) order.push(i);
      shuffle(order, rand);

      for (var id = 0; id < N; id++) {
        var pr = Math.floor(id / cols), pcc = id % cols;
        var el = document.createElement('div');
        el.className = 'arc-jig-p';
        el.style.cssText = 'position:absolute;touch-action:none;cursor:grab;width:' + pSize + 'px;height:' + pSize + 'px;';
        el.appendChild(pieceCanvas(pr, pcc));
        pieces.push({ id: id, r: pr, c: pcc, x: 0, y: 0, gid: id, anchored: false, inTray: true, el: el });
      }
      for (var k = 0; k < N; k++) {
        var tp = pieces[order[k]];
        tp.x = spots[k].x; tp.y = spots[k].y;
      }

      var wrap = document.createElement('div');
      msg = document.createElement('p');
      msg.className = 'arc-note';
      msg.style.cssText = 'text-align:center;min-height:1.5em;margin:4px 0 8px;';
      msg.textContent = 'Drag a piece. Correct pieces lock in. Pieces that join correctly move together.';

      world = document.createElement('div');
      world.style.cssText = 'position:relative;margin:0 auto;width:' + worldW + 'px;height:' + worldH + 'px;user-select:none;';

      boardEl = document.createElement('div');
      boardEl.className = 'arc-jig-board';
      boardEl.style.cssText = 'position:absolute;left:' + bx + 'px;top:' + by + 'px;width:' + BW + 'px;height:' + BH + 'px;border-radius:6px;background:#0b1528;box-shadow:inset 0 0 0 1px #2a3d63;';

      var gc = document.createElement('canvas');
      gc.width = BW; gc.height = BH;
      gc.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;border-radius:6px;';
      var gg = gc.getContext('2d');
      if (showRef) { gg.globalAlpha = 0.22; gg.drawImage(pic, 0, 0); gg.globalAlpha = 1; }
      gg.setLineDash([4, 4]);
      gg.strokeStyle = 'rgba(255,255,255,0.14)';
      gg.lineWidth = 1;
      for (var gr = 0; gr < rows; gr++) {
        for (var gq = 0; gq < cols; gq++) gg.strokeRect(gq * cell + 0.5, gr * cell + 0.5, cell - 1, cell - 1);
      }
      boardEl.appendChild(gc);
      world.appendChild(boardEl);

      pieces.forEach(function (p) {
        world.appendChild(p.el);
        place(p);
        bindDrag(p);
      });

      wrap.appendChild(msg);
      if (showRef) wrap.appendChild(buildPreview(src));
      wrap.appendChild(world);
      sess.stage.innerHTML = '';
      sess.stage.appendChild(wrap);

      sess.stats = function () {
        var s = [['Placed', placed + ' / ' + N], ['Wrong drops', String(mistakes)]];
        if (hasTimer) s.push(['Time', h.mmss(elapsed)]);
        return s;
      };
      if (hasTimer) {
        sess.every(function () {
          if (sess.done) return;
          elapsed++;
          sess.hudRefresh();
        }, 1000);
      }
      updateZ();
    }

    current = {
      move: onMove,
      up: onUp
    };

    sess.stage.innerHTML = '<p class="arc-note">🎨 Preparing your jigsaw from this idea…</p>';
    h.withArt(sess.idea, h.seedOf(sess.id), 480, 480, function (src) {
      if (h.cur() !== sess || sess.done) return;
      build(src);
    });
  };
})();