/* board-art.js: visual-note pictures built from the idea's own words.
   Four different layouts: Grid, Spotlight, Path, Web. The pop-up lets the player choose one. */
(function () {
  var STOP = ('the a an and or of to in on for with at by is are was were be been this that it its my our your i we you they he she from about into so then than just also make made get got go how what when where which who do does did not but if can will would should could have has had their them there here out watch need needs want wants some more most very really up down over under again after before while step steps plan idea').split(' ');
  var LABELS = { dob: 'Date of birth', cv: 'CV', app: 'App', site: 'Website', tel: 'Phone' };
  var ICONS = [
    [/\b(dob|birth|birthday|born)\b/, '🎂'],
    [/\b(age|old|years?)\b/, '⏳'],
    [/\b(money|pay|paid|price|cost|cash|income|profit|sell|sales|earn)\b/, '💰'],
    [/\b(research|study|learn|read|book|course|exam|school)\b/, '📚'],
    [/\b(site|web|website|online|internet|browser|page|platform)\b/, '🌐'],
    [/\b(cv|resume|job|work|office|career|interview|hire|apply)\b/, '💼'],
    [/\b(email|mail|message|send|letter|contact|reply)\b/, '✉️'],
    [/\b(copy|paste|text|note|list|file|document|write|draft)\b/, '📋'],
    [/\b(phone|call|mobile|sms|ring)\b/, '📱'],
    [/\b(map|route|travel|trip|flight|visit|journey|beach|city)\b/, '🗺️'],
    [/\b(food|cook|meal|recipe|kitchen|eat|coffee|cafe)\b/, '🍲'],
    [/\b(health|gym|run|exercise|sleep|diet|fitness|doctor)\b/, '🏃'],
    [/\b(home|house|family|kids|baby|friend|wedding)\b/, '🏡'],
    [/\b(music|song|art|paint|draw|design|photo|video|film)\b/, '🎨'],
    [/\b(careful|warn|danger|risk|avoid|scam|beware)\b/, '⚠️'],
    [/\b(time|date|deadline|due|tomorrow|week|today|clock)\b/, '⏰'],
    [/\b(idea|think|solve|problem|fix|build|goal|plan)\b/, '💡'],
    [/\b(check|verify|review|test|confirm|done)\b/, '✅']
  ];
  var PALS = [
    { paper: '#fff8e1', tint: '#fdf6e3', accent: '#e9a53b' },
    { paper: '#e8f5ff', tint: '#eef7ff', accent: '#2a7fbf' },
    { paper: '#f1ffe8', tint: '#f1fbe9', accent: '#3d9a5b' },
    { paper: '#fff0f5', tint: '#fdf0f6', accent: '#d6457b' },
    { paper: '#f4ecff', tint: '#f5efff', accent: '#7a4fc4' }
  ];
  var CAPS = ['Grid', 'Spotlight', 'Path', 'Web'];

  function hash(s) {
    var x = 5381;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0;
    return Math.abs(x);
  }

  function iconFor(label) {
    var t = label.toLowerCase();
    for (var i = 0; i < ICONS.length; i++) if (ICONS[i][0].test(t)) return ICONS[i][1];
    return '';
  }

  // Key words from the idea: title counts most, then body, then steps.
  function labelsOf(idea) {
    var steps = Array.isArray(idea.tasks)
      ? idea.tasks.map(function (t) { return (t && t.text) || ''; }).join(' ') : '';
    var score = {}, shown = {};
    function add(text, weight) {
      (text || '').split(/[^A-Za-z]+/).forEach(function (w, i) {
        var k = w.toLowerCase();
        if (k.length < 3 || STOP.indexOf(k) >= 0) return;
        score[k] = (score[k] || 0) + weight + (i > 0 && /^[A-Z]/.test(w) ? 1 : 0);
        if (!shown[k]) shown[k] = LABELS[k] || (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      });
    }
    add(idea.title, 3); add(idea.body, 1); add(idea.desc, 1); add(steps, 2);
    return Object.keys(score)
      .sort(function (a, b) { return score[b] - score[a] || a.localeCompare(b); })
      .slice(0, 8).map(function (k) { return shown[k]; });
  }

  function fill6(list) {
    var out = list.slice(), extra = ['Idea', 'Plan', 'Step', 'Goal', 'Next', 'Done'];
    for (var i = 0; out.length < 6 && i < extra.length; i++) {
      if (out.indexOf(extra[i]) < 0) out.push(extra[i]);
    }
    while (out.length < 6) out.push('Idea');
    return out.slice(0, 6);
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }

  function fit(g, text, maxW, size) {
    var s = size;
    while (s > 8) {
      g.font = 'bold ' + s + 'px sans-serif';
      if (g.measureText(text).width <= maxW) break;
      s--;
    }
  }

  // One visual note: icon disc, number badge, and a sticky label.
  function note(label, n, w, h, pal) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d'), s = Math.min(w, h);
    g.fillStyle = pal.paper;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.07)';
    for (var y = s * 0.05; y < h; y += s * 0.09) {
      for (var x = s * 0.05; x < w; x += s * 0.09) g.fillRect(x, y, 1.5, 1.5);
    }
    g.globalAlpha = 0.18;
    g.fillStyle = pal.accent;
    g.beginPath(); g.arc(w * 0.85, h * 0.12, s * 0.3, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = '#2b2b2b';
    g.lineWidth = Math.max(1.5, s * 0.012);
    roundRect(g, s * 0.03, s * 0.03, w - s * 0.06, h - s * 0.06, s * 0.06);
    g.stroke();

    var cx = w / 2, cy = h * 0.42, r = s * 0.24;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = pal.accent;
    g.lineWidth = s * 0.03;
    g.stroke();

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    var icon = iconFor(label);
    if (icon) {
      g.font = Math.round(r * 1.1) + 'px serif';
      g.fillStyle = '#2b2b2b';
      g.fillText(icon, cx, cy + r * 0.05);
    } else {
      g.font = 'bold ' + Math.round(r * 1.2) + 'px sans-serif';
      g.fillStyle = pal.accent;
      g.fillText(label.charAt(0).toUpperCase(), cx, cy + r * 0.05);
    }

    g.fillStyle = pal.accent;
    g.beginPath(); g.arc(s * 0.12, s * 0.12, s * 0.09, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold ' + Math.round(s * 0.1) + 'px sans-serif';
    g.fillText(String(n), s * 0.12, s * 0.125);

    var lw = w * 0.8, lh = h * 0.18, lx = (w - lw) / 2, ly = h * 0.7;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.25)';
    g.shadowBlur = s * 0.03;
    g.shadowOffsetY = s * 0.015;
    g.fillStyle = '#fffbd1';
    roundRect(g, lx, ly, lw, lh, s * 0.05);
    g.fill();
    g.restore();
    g.fillStyle = '#2b2b2b';
    fit(g, label, lw * 0.88, Math.round(lh * 0.55));
    g.fillText(label, w / 2, ly + lh / 2);
    return c;
  }

  // Four layouts. Each one looks different on purpose.
  function layout(kind, T, W, H, pal) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d'), s = Math.min(W, H);
    g.fillStyle = pal.tint;
    g.fillRect(0, 0, W, H);

    function put(i, x, y, w, hh) {
      g.drawImage(note(T[i], i + 1, Math.round(w), Math.round(hh), pal), x, y, w, hh);
    }
    function arrow(x1, y1, x2, y2) {
      g.strokeStyle = pal.accent;
      g.fillStyle = pal.accent;
      g.lineWidth = s * 0.02;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      var a = Math.atan2(y2 - y1, x2 - x1), k = s * 0.05;
      g.beginPath();
      g.moveTo(x2, y2);
      g.lineTo(x2 - k * Math.cos(a - 0.4), y2 - k * Math.sin(a - 0.4));
      g.lineTo(x2 - k * Math.cos(a + 0.4), y2 - k * Math.sin(a + 0.4));
      g.closePath(); g.fill();
    }

    if (kind === 0) {
      // Grid: three across, two down.
      for (var i = 0; i < 6; i++) put(i, (i % 3) * W / 3, Math.floor(i / 3) * H / 2, W / 3, H / 2);
    } else if (kind === 1) {
      // Spotlight: one big note with five smaller ones around it.
      put(0, 0, 0, W * 0.58, H * 0.58);
      for (var j = 0; j < 3; j++) put(j + 1, W * 0.6, j * H * 0.58 / 3, W * 0.4, H * 0.58 / 3);
      put(4, 0, H * 0.6, W * 0.5, H * 0.4);
      put(5, W * 0.5, H * 0.6, W * 0.5, H * 0.4);
    } else if (kind === 2) {
      // Path: a snake route with arrows showing the order.
      var pos = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1]], pw = W / 3, ph = H / 2;
      for (var p = 0; p < 6; p++) {
        put(p, pos[p][0] * pw + pw * 0.08, pos[p][1] * ph + ph * 0.08, pw * 0.84, ph * 0.84);
      }
      for (var a = 0; a < 5; a++) {
        var x1 = (pos[a][0] + 0.5) * pw, y1 = (pos[a][1] + 0.5) * ph;
        var x2 = (pos[a + 1][0] + 0.5) * pw, y2 = (pos[a + 1][1] + 0.5) * ph;
        var mx = (x1 + x2) / 2, my = (y1 + y2) / 2, vx = (x2 - x1) / 4, vy = (y2 - y1) / 4;
        arrow(mx - vx, my - vy, mx + vx, my + vy);
      }
    } else {
      // Web: a centre idea with five connected notes.
      var cx = W / 2, cy = H / 2, R = s * 0.34, cs = s * 0.34, ss = s * 0.3;
      function ang(q) { return -Math.PI / 2 + q * 2 * Math.PI / 5; }
      for (var q = 0; q < 5; q++) {
        g.strokeStyle = pal.accent;
        g.lineWidth = s * 0.015;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(ang(q)) * R, cy + Math.sin(ang(q)) * R);
        g.stroke();
      }
      put(0, cx - cs / 2, cy - cs / 2, cs, cs);
      for (var q2 = 0; q2 < 5; q2++) {
        put(q2 + 1, cx + Math.cos(ang(q2)) * R - ss / 2, cy + Math.sin(ang(q2)) * R - ss / 2, ss, ss);
      }
    }
    return c;
  }

  function makeArt(idea, k, W, H) {
    var base = fill6(labelsOf(idea)), n = base.length, sh = k % n;
    var T = base.slice(sh).concat(base.slice(0, sh));
    var pal = PALS[(hash(idea.title || idea.body || '') + k) % PALS.length];
    return layout(k % 4, T, W, H, pal);
  }

  // Used by games when no choice is shown.
  window.hvSceneArt = function (idea, variant, w, h) {
    return makeArt(idea || {}, Math.abs(variant || 0) % 4, w || 480, h || 480);
  };

  // Key words, used by Mind Lab's picture board.
  window.hvKeys = function (idea) { return labelsOf(idea || {}); };

  window.hvVisualNote = function (word, n, w, h) {
    return note(word || 'Idea', n || 1, w || 240, h || 170, PALS[0]);
  };

  // Summary: no repeated sentences, plain "in short" line, steps, key words.
  window.hvSummaryBlock = function (idea) {
    idea = idea || {};
    var box = document.createElement('div');
    box.style.cssText = 'margin:8px 0 14px;line-height:1.5;';
    function heading(t) {
      var d = document.createElement('div');
      d.style.cssText = 'font-weight:bold;margin:10px 0 4px;';
      d.textContent = t;
      box.appendChild(d);
    }
    function line(t) {
      var p = document.createElement('div');
      p.textContent = t;
      box.appendChild(p);
    }
    var labels = labelsOf(idea), seen = {}, sents = [];
    [idea.title, idea.body, idea.desc].forEach(function (t) {
      (t || '').split(/[.!?\n]+/).forEach(function (s) {
        s = s.trim();
        var k = s.toLowerCase();
        if (s.length > 3 && !seen[k]) { seen[k] = 1; sents.push(s); }
      });
    });
    heading('In short');
    line(labels.length
      ? 'This idea is about ' + labels.slice(0, 5).join(', ') + '.'
      : 'Add a few words to the idea to see a summary here.');
    if (sents.length) {
      heading('What you wrote');
      sents.slice(0, 3).forEach(function (s) { line(s + '.'); });
    }
    var steps = Array.isArray(idea.tasks)
      ? idea.tasks.map(function (t) { return t && t.text; }).filter(Boolean) : [];
    if (steps.length) {
      heading('Steps');
      var ol = document.createElement('ol');
      ol.style.cssText = 'margin:0;padding-left:20px;';
      steps.slice(0, 8).forEach(function (t) {
        var li = document.createElement('li');
        li.textContent = t;
        ol.appendChild(li);
      });
      box.appendChild(ol);
    }
    if (labels.length) {
      heading('Key words');
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
      labels.forEach(function (k) {
        var chip = document.createElement('span');
        chip.style.cssText = 'padding:3px 10px;border-radius:12px;background:#ffb800;color:#1d1d1d;font-size:13px;';
        chip.textContent = k;
        row.appendChild(chip);
      });
      box.appendChild(row);
    }
    return box;
  };

  // Pop-up: four different pictures. Tap one, then play with it.
  window.hvPickPicture = function (idea, w, h, cb) {
    idea = idea || {};
    var chosen = 0, frames = [];
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(5,10,20,.78);z-index:200000;display:flex;align-items:center;justify-content:center;padding:16px;';
    var card = document.createElement('div');
    card.style.cssText = 'background:#0f1b30;color:#fff;border-radius:14px;padding:16px;max-width:420px;width:100%;text-align:center;font-family:sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);';
    card.innerHTML = '<h3 style="margin:0 0 4px;">🖼️ Which picture do you want to play with?</h3>' +
      '<p style="margin:0 0 12px;opacity:.85;font-size:14px;">Tap the one you like, then press Play.</p>';
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;';
    function highlight() {
      frames.forEach(function (f, i) {
        f.style.border = i === chosen ? '3px solid #ffb800' : '3px solid transparent';
      });
    }
    for (var k = 0; k < 4; k++) {
      (function (idx) {
        var b = document.createElement('button');
        b.type = 'button';
        b.style.cssText = 'padding:4px;border-radius:10px;border:3px solid transparent;background:#1a2a47;color:#fff;cursor:pointer;font-size:12px;';
        var t = makeArt(idea, idx, 300, 300);
        t.style.cssText = 'display:block;width:100%;height:auto;border-radius:7px;';
        b.appendChild(t);
        var cap = document.createElement('div');
        cap.textContent = CAPS[idx];
        cap.style.cssText = 'margin-top:4px;';
        b.appendChild(cap);
        b.addEventListener('click', function () { chosen = idx; highlight(); });
        frames.push(b);
        grid.appendChild(b);
      })(k);
    }
    highlight();
    var play = document.createElement('button');
    play.type = 'button';
    play.textContent = '▶ Play with this picture';
    play.style.cssText = 'margin-top:14px;padding:10px 18px;border-radius:20px;border:none;background:#ffb800;color:#1d1d1d;font-weight:bold;font-size:15px;cursor:pointer;';
    play.addEventListener('click', function () {
      ov.remove();
      cb(makeArt(idea, chosen, w || 480, h || 480));
    });
    card.appendChild(grid);
    card.appendChild(play);
    ov.appendChild(card);
    document.body.appendChild(ov);
  };
})();