/* jigsaw.js: a real jigsaw. Correct pieces lock in place. Wrong pieces stay
   where you drop them and can be moved. Correctly joined pieces merge into
   one group that moves together. Pieces never repel. */
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
    var drag = null, syncOn = false;
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

    function freeSpot(gid) {
      for (var i = 0; i < spots.length; i++) {
        var s = spots[i], busy = false;
        for (var j = 0; j < pieces.length && !busy; j++) {
          var q = pieces[j];
          if (q.gid === gid) continue;
          if (Math.abs(q.x - s.x) < pitch * 0.7 && Math.abs(q.y - s.y) < pitch * 0.7) busy = true;
        }
        if (!busy) return s;
      }
      return { x: 12, y: worldH - pSize - 4 };
    }

    function displace(gid) {
      var G = members(gid), q = G[0];
      var s = freeSpot(gid);
      shiftGroup(G, s.x - q.x, s.y - q.y);
    }

    function anchor(G) {
      G.forEach(function (m) {
        if (!m.anchored) placed++;
        m.x = slotX(m); m.y = slotY(m);
        m.anchored = true;
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
        if (hit) displace(q.gid);
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
          if (!q || q.gid === gid) continue;
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

    function startSync() {
      if (syncOn) return;
      syncOn = true;
      (function frame() {
        if (!drag) { syncOn = false; return; }
        syncMembers();
        requestAnimationFrame(frame);
      })();
    }

    function onMove(e) {
      if (!drag) return;
      var L = drag.leader, mv = parseMove(L.el);
      mv.x += e.clientX - drag.lx;
      mv.y += e.clientY - drag.ly;
      drag.lx = e.clientX; drag.ly = e.clientY;
      L.el.style.transform = 'translate(' + mv.x + 'px, ' + mv.y + 'px)';
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
      if (L.anchored) {
        note = now.length > 1 ? '🔗 Locked in with its neighbours!' : '✅ Locked in. Nice placement.';
      } else if (now.length > size) {
        note = '🔗 Pieces joined. They move together now.';
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
        drag = { leader: p, gid: p.gid, lx: e.clientX, ly: e.clientY, size: G.length };
        G.forEach(function (m) { m.el.style.zIndex = 4; });
        startSync();
      });
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
        pieces.push({ id: id, r: pr, c: pcc, x: 0, y: 0, gid: id, anchored: false, el: el });
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

    current = { move: onMove, up: onUp };

    sess.stage.innerHTML = '<p class="arc-note">🎨 Preparing your jigsaw from this idea…</p>';
    h.withArt(sess.idea, h.seedOf(sess.id), 480, 480, function (src) {
      if (h.cur() !== sess || sess.done) return;
      build(src);
    });
  };
})();