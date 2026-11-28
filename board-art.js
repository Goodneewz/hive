/* board-art.js: picture games show a pop-up with four pictures from the idea.
   The player picks one, then the game starts with it. */
(function () {
  var TINTS = ['#fdf8ec', '#eef7ff', '#f3fbea', '#fdf0f6'];

  function keysFor(idea) {
    var s = window.hvSummary ? window.hvSummary(idea) : { keys: [] };
    var list = s.keys.slice();
    var extra = ['idea', 'plan', 'step', 'goal', 'next', 'done'];
    for (var i = 0; list.length < 6 && i < extra.length; i++) {
      if (list.indexOf(extra[i]) < 0) list.push(extra[i]);
    }
    return list;
  }

  // One picture: six visual notes, ordered differently for each option k (0 to 3).
  function makeArt(idea, k, W, H) {
    var keys = keysFor(idea);
    var order = k % 2 ? keys.slice().reverse() : keys.slice();
    var start = Math.floor(k / 2) % order.length;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = TINTS[k % TINTS.length];
    g.fillRect(0, 0, W, H);
    var cw = W / 2, ch = H / 3;
    for (var i = 0; i < 6; i++) {
      var word = order[(start + i) % order.length];
      g.drawImage(window.hvVisualNote(word, i + 1, cw, ch), (i % 2) * cw, Math.floor(i / 2) * ch, cw, ch);
    }
    return c;
  }

  // Used when no choice is shown.
  window.hvSceneArt = function (idea, variant, w, h) {
    return makeArt(idea || {}, Math.abs(variant || 0) % 4, w || 480, h || 480);
  };

  // The pop-up: pick one of four pictures, then play.
  window.hvPickPicture = function (idea, w, h, cb) {
    idea = idea || {};
    var chosen = 0;
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(5,10,20,.78);z-index:200000;display:flex;align-items:center;justify-content:center;padding:16px;';

    var card = document.createElement('div');
    card.style.cssText = 'background:#0f1b30;color:#fff;border-radius:14px;padding:16px;max-width:420px;width:100%;text-align:center;font-family:sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);';

    var title = document.createElement('h3');
    title.style.cssText = 'margin:0 0 4px;';
    title.textContent = '🖼️ Which picture do you want to play with?';

    var sub = document.createElement('p');
    sub.style.cssText = 'margin:0 0 12px;opacity:.85;font-size:14px;';
    sub.textContent = 'Tap the one you like, then press Play.';

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;';

    var frames = [];
    function highlight() {
      frames.forEach(function (f, i) {
        f.style.border = i === chosen ? '3px solid #ffb800' : '3px solid transparent';
      });
    }

    for (var k = 0; k < 4; k++) {
      (function (idx) {
        var b = document.createElement('button');
        b.type = 'button';
        b.style.cssText = 'padding:0;border-radius:10px;border:3px solid transparent;background:none;cursor:pointer;';
        var thumb = makeArt(idea, idx, 200, 200);
        thumb.style.cssText = 'display:block;width:100%;height:auto;border-radius:7px;';
        b.appendChild(thumb);
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

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(grid);
    card.appendChild(play);
    ov.appendChild(card);
    document.body.appendChild(ov);
  };
})();