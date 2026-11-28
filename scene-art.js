/* scene-art.js: a different picture for each idea, built from its own words. */
(function () {
  var PALS = [
    ['#ff9a76', '#ffd38a', '#fff3c4', '#8e5a8a', '#3d2b4f'],
    ['#7fd3ff', '#d8f4ff', '#ffe066', '#7bc47f', '#2e7d4f'],
    ['#0f2027', '#2c5364', '#f5f0d8', '#22414f', '#0b1a22'],
    ['#ffb199', '#ff5c8a', '#ffe29f', '#7a2c5e', '#3e1431'],
    ['#a8e6cf', '#dcedc1', '#ffd3b6', '#56ab2f', '#1d4d1d'],
    ['#fbc2eb', '#a6c1ee', '#fff6b7', '#5b6bb5', '#2c3e7a'],
    ['#89f7fe', '#66a6ff', '#fff3a3', '#3f8fd2', '#1c3b6e'],
    ['#f6d365', '#fda085', '#fff7d6', '#b9643c', '#5a2e17']
  ];

  var THEMES = [
    { scene: 'city', icon: '💻', words: ['app', 'software', 'website', 'code', 'phone', 'digital', 'tech', 'online', 'system', 'ai'] },
    { scene: 'sea', icon: '✈️', words: ['travel', 'trip', 'journey', 'tour', 'holiday', 'flight', 'visit', 'route', 'beach', 'map'] },
    { scene: 'hills', icon: '📚', words: ['study', 'school', 'learn', 'book', 'course', 'exam', 'teach', 'read', 'lesson', 'research'] },
    { scene: 'city', icon: '💰', words: ['money', 'business', 'sell', 'shop', 'price', 'sales', 'market', 'customer', 'profit', 'income', 'startup'] },
    { scene: 'forest', icon: '🌱', words: ['health', 'gym', 'run', 'exercise', 'diet', 'sleep', 'fitness', 'walk', 'yoga', 'garden', 'plant', 'farm', 'tree', 'nature', 'park'] },
    { scene: 'sea', icon: '🍲', words: ['food', 'cook', 'recipe', 'restaurant', 'cafe', 'bake', 'meal', 'kitchen', 'coffee'] },
    { scene: 'night', icon: '🎨', words: ['music', 'song', 'art', 'paint', 'draw', 'film', 'video', 'photo', 'design', 'story', 'write'] },
    { scene: 'hills', icon: '🏡', words: ['home', 'house', 'family', 'kids', 'friend', 'wedding', 'baby', 'care'] }
  ];
  var DEFAULT = { scene: 'hills', icon: '💡' };

  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function rng(seed) {
    var a = seed || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function ideaText(idea) {
    var out = [idea.title || '', idea.body || '', idea.desc || ''];
    var a = idea.assist;
    if (a && a.answers && typeof a.answers === 'object') {
      Object.keys(a.answers).forEach(function (k) {
        var v = a.answers[k];
        if (typeof v === 'string') out.push(v);
      });
    }
    if (Array.isArray(idea.tasks)) {
      idea.tasks.forEach(function (t) { if (t && t.text) out.push(t.text); });
    }
    return out.join(' ');
  }

  function pickTheme(text) {
    var words = text.toLowerCase().split(/[^a-z]+/);
    var best = null, score = 0;
    THEMES.forEach(function (t) {
      var n = 0;
      words.forEach(function (w) { if (t.words.indexOf(w) >= 0) n++; });
      if (n > score) { score = n; best = t; }
    });
    return best || DEFAULT;
  }

  function sun(g, W, H, color, r) {
    var x = W * (0.15 + r() * 0.7), y = H * (0.12 + r() * 0.2), rad = W * (0.05 + r() * 0.04);
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2);
    g.fillStyle = color; g.fill();
  }

  function cloud(g, x, y, s) {
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath();
    g.arc(x, y, s, 0, Math.PI * 2);
    g.arc(x + s * 0.9, y - s * 0.4, s * 0.8, 0, Math.PI * 2);
    g.arc(x + s * 1.8, y, s * 0.9, 0, Math.PI * 2);
    g.fill();
  }

  function ridge(g, W, H, baseY, amp, freq, phase, color) {
    g.beginPath();
    g.moveTo(0, H);
    for (var x = 0; x <= W; x += 4) g.lineTo(x, baseY + Math.sin(x * freq + phase) * amp);
    g.lineTo(W, H);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  }

  function waveLine(g, W, y, amp, freq, phase, color) {
    g.beginPath();
    for (var x = 0; x <= W; x += 4) {
      var py = y + Math.sin(x * freq + phase) * amp;
      if (x === 0) g.moveTo(x, py); else g.lineTo(x, py);
    }
    g.strokeStyle = color;
    g.lineWidth = Math.max(1.5, W * 0.006);
    g.stroke();
  }

  var SCENES = {
    hills: function (g, W, H, pal, r) {
      sun(g, W, H, pal[2], r);
      ridge(g, W, H, H * 0.52, H * 0.05, 0.012, r() * 6, pal[3]);
      ridge(g, W, H, H * 0.68, H * 0.06, 0.009, r() * 6, pal[4]);
    },
    sea: function (g, W, H, pal, r) {
      sun(g, W, H, pal[2], r);
      var hz = H * 0.55;
      g.fillStyle = pal[3];
      g.fillRect(0, hz, W, H - hz);
      for (var i = 0; i < 7; i++) {
        waveLine(g, W, hz + H * 0.05 + i * H * 0.06, H * 0.012, 0.03 + i * 0.002, r() * 6, 'rgba(255,255,255,0.45)');
      }
      var bx = W * (0.2 + r() * 0.6), by = hz - H * 0.02;
      g.fillStyle = '#fffaf0';
      g.beginPath();
      g.moveTo(bx, by - H * 0.2);
      g.lineTo(bx, by);
      g.lineTo(bx + W * 0.1, by);
      g.closePath();
      g.fill();
      g.fillStyle = pal[4];
      g.fillRect(bx - W * 0.07, by, W * 0.17, H * 0.03);
    },
    city: function (g, W, H, pal, r) {
      sun(g, W, H, pal[2], r);
      var x = 0;
      while (x < W) {
        var bw = W * (0.08 + r() * 0.07), bh = H * (0.2 + r() * 0.35), top = H - bh;
        g.fillStyle = pal[4];
        g.fillRect(x, top, bw - 3, bh);
        for (var wy = top + H * 0.03; wy < H - H * 0.04; wy += H * 0.05) {
          for (var wx = x + bw * 0.18; wx < x + bw * 0.7; wx += bw * 0.26) {
            g.fillStyle = r() > 0.4 ? pal[2] : 'rgba(255,255,255,0.12)';
            g.fillRect(wx, wy, bw * 0.12, H * 0.025);
          }
        }
        x += bw;
      }
    },
    forest: function (g, W, H, pal, r) {
      sun(g, W, H, pal[2], r);
      g.fillStyle = pal[3];
      g.fillRect(0, H * 0.68, W, H * 0.32);
      var trees = [];
      for (var i = 0; i < 16; i++) {
        trees.push({ x: r() * W, y: H * (0.6 + r() * 0.3), h: H * (0.09 + r() * 0.12) });
      }
      trees.sort(function (a, b) { return a.y - b.y; });
      trees.forEach(function (t) {
        g.fillStyle = '#5a3b22';
        g.fillRect(t.x - t.h * 0.05, t.y, t.h * 0.1, t.h * 0.25);
        g.fillStyle = pal[4];
        g.beginPath();
        g.moveTo(t.x, t.y - t.h);
        g.lineTo(t.x - t.h * 0.4, t.y + t.h * 0.05);
        g.lineTo(t.x + t.h * 0.4, t.y + t.h * 0.05);
        g.closePath();
        g.fill();
      });
    },
    night: function (g, W, H, pal, r) {
      for (var i = 0; i < 120; i++) {
        g.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.7).toFixed(2) + ')';
        g.fillRect(r() * W, r() * H * 0.6, 2, 2);
      }
      sun(g, W, H, pal[2], r);
      ridge(g, W, H, H * 0.6, H * 0.05, 0.01, r() * 6, pal[3]);
      ridge(g, W, H, H * 0.75, H * 0.05, 0.014, r() * 6, pal[4]);
    }
  };

  function overlay(g, W, H, theme, title) {
    g.beginPath();
    g.arc(W / 2, H * 0.42, W * 0.13, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fill();
    g.font = Math.round(W * 0.14) + 'px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#000';
    g.fillText(theme.icon, W / 2, H * 0.42);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(0, H * 0.86, W, H * 0.14);
    g.fillStyle = '#ffffff';
    g.font = 'bold ' + Math.round(W * 0.05) + 'px sans-serif';
    var t = title.length > 28 ? title.slice(0, 27) + '…' : title;
    g.fillText(t || 'My idea', W / 2, H * 0.93);
  }

  function build(idea, variant, w, h) {
    idea = idea || {};
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var g = c.getContext('2d');
    var seed = hash((idea.id || '') + '|' + (idea.title || '') + '|' + (variant || 0));
    var r = rng(seed);
    var pal = PALS[seed % PALS.length];
    var theme = pickTheme(ideaText(idea));
    var sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, pal[0]);
    sky.addColorStop(1, pal[1]);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    for (var i = 0; i < 3; i++) {
      cloud(g, w * (0.1 + r() * 0.7), h * (0.08 + r() * 0.25), w * (0.03 + r() * 0.02));
    }
    (SCENES[theme.scene] || SCENES.hills)(g, w, h, pal, r);
    overlay(g, w, h, theme, idea.title || '');
    return c;
  }

  window.withArt = function (idea, variant, w, h, cb) {
    cb(build(idea, variant, w, h));
  };
  window.hvSceneArt = build;
})();