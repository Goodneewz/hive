/* visual-notes.js: visual-note pictures and a summary built from the idea's own words. */
(function () {
  var STOP = 'the a an and or of to in on for with at by is are was be this that it its my our your i we you they from about into so then than just also make made get go how what when where which who do does did not but if can will would should'.split(' ');

  var ICONS = [
    [/money|pay|income|sell|sales|price|profit|cash|earn|business|market/, '💰'],
    [/research|study|learn|read|find|search|look|explore|check/, '🔍'],
    [/site|web|website|online|platform|app|page|internet|browser/, '🌐'],
    [/cv|resume|job|work|apply|career|interview|hire|office/, '💼'],
    [/mail|email|send|message|letter|write|contact/, '✉️'],
    [/copy|paste|text|note|list|file|document/, '📋'],
    [/plan|route|step|map|schedule|timeline|goal/, '🗺️'],
    [/phone|mobile|call|ring|sms/, '📱'],
    [/food|cook|meal|recipe|kitchen|eat|coffee|cafe/, '🍲'],
    [/travel|trip|flight|visit|journey|holiday|beach/, '✈️'],
    [/health|gym|run|exercise|sleep|diet|fitness/, '🏃'],
    [/home|house|family|kids|baby|friend/, '🏡'],
    [/music|song|art|paint|draw|design|photo|video|film/, '🎨'],
    [/idea|think|solve|problem|fix|build|make/, '💡'],
    [/time|date|deadline|due|tomorrow|week|today/, '⏰']
  ];
  var PAPERS = ['#fff8e1', '#e8f5ff', '#f1ffe8', '#fff0f5', '#f4ecff'];
  var ACCENTS = ['#ff8a5b', '#2a9d8f', '#e9a53b', '#e76f51', '#457b9d', '#8ab17d'];

  function hash(s) {
    var x = 5381;
    for (var i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0;
    return Math.abs(x) || 1;
  }

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function words(text) {
    return (text || '').toLowerCase().split(/[^a-z]+/).filter(function (w) {
      return w.length > 2 && STOP.indexOf(w) < 0;
    });
  }

  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

  function iconFor(w) {
    for (var i = 0; i < ICONS.length; i++) {
      if (ICONS[i][0].test(w)) return ICONS[i][1];
    }
    return '📌';
  }

  function fitFont(g, text, maxW, size, weight) {
    var s = size;
    while (s > 9) {
      g.font = weight + ' ' + s + 'px sans-serif';
      if (g.measureText(text).width <= maxW) break;
      s--;
    }
    return s;
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

  function note(word, n, w, h) {
    var seed = hash(word + '|' + n);
    var R = rng(seed);
    var paper = PAPERS[seed % PAPERS.length];
    var accent = ACCENTS[(seed >> 3) % ACCENTS.length];
    var ink = '#2b2b2b';

    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var g = cv.getContext('2d');

    // Paper with a faint dot grid.
    g.fillStyle = paper;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (var y = 14; y < h; y += 18) {
      for (var x = 14; x < w; x += 18) g.fillRect(x, y, 1.6, 1.6);
    }

    // Soft colour blob and a hand-drawn frame.
    g.globalAlpha = 0.18;
    g.fillStyle = accent;
    g.beginPath();
    g.arc(w * 0.82, h * 0.18, w * 0.22, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = ink;
    g.lineWidth = 2;
    roundRect(g, 8, 8, w - 16, h - 16, 12);
    g.stroke();

    // The icon in a circle, with little sparkles.
    var cx = w * 0.5, cy = h * 0.4, rad = Math.min(w, h) * 0.25;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = accent;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.stroke();
    g.font = Math.round(rad * 1.1) + 'px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = ink;
    g.fillText(iconFor(word), cx, cy + 2);

    g.strokeStyle = accent;
    g.lineWidth = 3;
    g.lineCap = 'round';
    [-2.5, -1.57, -0.65].forEach(function (a) {
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * rad * 1.2, cy + Math.sin(a) * rad * 1.2);
      g.lineTo(cx + Math.cos(a) * rad * 1.45, cy + Math.sin(a) * rad * 1.45);
      g.stroke();
    });

    // Number badge.
    g.fillStyle = accent;
    g.beginPath();
    g.arc(w * 0.14, h * 0.16, w * 0.085, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold ' + Math.round(w * 0.09) + 'px sans-serif';
    g.fillText(String(n), w * 0.14, h * 0.16 + 1);

    // Sticky-note label, slightly tilted.
    var label = cap(word);
    var lw = w * 0.72, lh = h * 0.17, lx = (w - lw) / 2, ly = h * 0.68;
    g.save();
    g.translate(w / 2, ly + lh / 2);
    g.rotate((R() - 0.5) * 0.06);
    g.translate(-w / 2, -(ly + lh / 2));
    g.shadowColor = 'rgba(0,0,0,0.25)';
    g.shadowBlur = 6;
    g.shadowOffsetY = 3;
    g.fillStyle = '#fffbd1';
    roundRect(g, lx, ly, lw, lh, 8);
    g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = ink;
    fitFont(g, label, lw * 0.86, Math.round(lh * 0.55), 'bold');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, w / 2, ly + lh / 2);
    g.restore();

    return cv;
  }

  // One picture: a visual note for a single word.
  window.hvVisualNote = function (word, n, w, h) {
    return note(word || 'idea', n || 1, w || 240, h || 170);
  };

  // A grid of visual notes, one per word.
  window.hvVisualGrid = function (list, cols) {
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(' + (cols || 3) + ',1fr);gap:10px;margin:8px 0 12px;';
    list.forEach(function (w, i) {
      var cell = document.createElement('div');
      cell.style.cssText = 'border-radius:12px;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,.35);';
      var cv = note(w, i + 1, 240, 170);
      cv.style.cssText = 'display:block;width:100%;height:auto;';
      cell.appendChild(cv);
      grid.appendChild(cell);
    });
    return grid;
  };

  // Summary data, built from the idea's title, notes, and steps.
  window.hvSummary = function (idea) {
    idea = idea || {};
    var body = [idea.title, idea.body, idea.desc].filter(Boolean).join('. ');
    var sentences = body.split(/[.!?\n]+/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 8; });
    var steps = Array.isArray(idea.tasks)
      ? idea.tasks.map(function (t) { return t && t.text; }).filter(Boolean) : [];
    var counts = {};
    words(body + ' ' + steps.join(' ')).forEach(function (w) { counts[w] = (counts[w] || 0) + 1; });
    var keys = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a] || a.localeCompare(b);
    }).slice(0, 6);
    return { what: sentences.slice(0, 2), steps: steps.slice(0, 8), keys: keys };
  };

  // A readable summary block with the idea's key words as visual notes.
  window.hvSummaryBlock = function (idea) {
    var s = window.hvSummary(idea);
    var box = document.createElement('div');
    box.style.cssText = 'margin:8px 0 14px;line-height:1.5;';

    function heading(t) {
      var d = document.createElement('div');
      d.style.cssText = 'font-weight:bold;margin:10px 0 4px;';
      d.textContent = t;
      box.appendChild(d);
    }

    heading('What this idea is');
    if (s.what.length) {
      s.what.forEach(function (t) {
        var p = document.createElement('div');
        p.textContent = t + '.';
        box.appendChild(p);
      });
    } else {
      var empty = document.createElement('div');
      empty.textContent = 'Add a few words to the idea to see a summary here.';
      box.appendChild(empty);
    }

    if (s.steps.length) {
      heading('Steps');
      var ol = document.createElement('ol');
      ol.style.cssText = 'margin:0;padding-left:20px;';
      s.steps.forEach(function (t) {
        var li = document.createElement('li');
        li.textContent = t;
        ol.appendChild(li);
      });
      box.appendChild(ol);
    }

    if (s.keys.length) {
      heading('Key words');
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
      s.keys.forEach(function (k) {
        var chip = document.createElement('span');
        chip.style.cssText = 'padding:3px 10px;border-radius:12px;background:#ffb800;color:#1d1d1d;font-size:13px;';
        chip.textContent = cap(k);
        row.appendChild(chip);
      });
      box.appendChild(row);
    }
    return box;
  };
})();