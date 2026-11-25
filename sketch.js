/* sketch.js: a design-tool style sketch pad for Hive.
   - Replaces the old sketch canvas inside the Sketch window.
   - Layout: paper on top, tools below. Shapes live in a folder.
   - Eraser removes only what you pass over. Undo and redo cover every action.
   - Clear all asks first and can be undone.
   - Add sketch saves a PNG and adds it as an attachment, like a photo. */
(() => {
  'use strict';


  const W = 1000, H = 625, MAX_HISTORY = 30;
  const INK = '#111827', CHALK = '#f8fafc';
  const PALETTE = ['#111827', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#92400e'];
  const BG = { white: '#ffffff', paper: '#fffdf5', dark: '#0f1a2e' };


  const GROUPS = [
    ['Draw', [
      { id: 'pen', icon: '✏️', label: 'Pen', key: 'p', hint: 'Smooth lines for quick sketches. Hold Shift to draw a straight line.' },
      { id: 'brush', icon: '🖌️', label: 'Brush', key: 'b', hint: 'Thick, soft strokes for colour blocks.' },
      { id: 'marker', icon: '🖍️', label: 'Marker', key: 'm', hint: 'Bold strokes with a slight see-through.' },
      { id: 'highlight', icon: '🟨', label: 'Highlight', key: 'h', hint: 'Wide and transparent. Good for marking what matters.' },
      { id: 'eraser', icon: '🧽', label: 'Eraser', key: 'e', hint: 'Removes only what you pass over. Everything else stays. Undo brings it back.' }
    ]],
    ['Shapes', [
      { id: 'line', icon: '╱', label: 'Line', key: 'l', hint: 'Drag to draw. Hold Shift to snap to 15° angles.' },
      { id: 'arrow', icon: '➜', label: 'Arrow', key: 'a', hint: 'Drag from where it starts to where it points.' },
      { id: 'rect', icon: '▭', label: 'Box', key: 'r', hint: 'Drag a box. Hold Shift for a perfect square.' },
      { id: 'ellipse', icon: '◯', label: 'Circle', key: 'o', hint: 'Drag an oval. Hold Shift for a perfect circle.' },
      { id: 'triangle', icon: '△', label: 'Triangle', key: '', hint: 'Drag to size the triangle.' },
      { id: 'diamond', icon: '◇', label: 'Diamond', key: 'd', hint: 'Drag to size the diamond.' },
      { id: 'star', icon: '★', label: 'Star', key: 's', hint: 'Click the centre, then drag out. Further out means a bigger star.' }
    ]],
    ['Write', [
      { id: 'text', icon: 'T', label: 'Text', key: 't', hint: 'Click where the words go, type, then press Enter. Esc cancels.' },
      { id: 'note', icon: '🗒️', label: 'Sticky', key: 'n', hint: 'Click to place a sticky note in the current colour. Type, then press Enter.' }
    ]],
    ['Fix', [
      { id: 'fill', icon: '🪣', label: 'Fill', key: 'f', hint: 'Click inside a closed shape to fill it with the current colour.' },
      { id: 'pick', icon: '💧', label: 'Picker', key: 'i', hint: 'Click any drawn spot to copy its colour.' }
    ]]
  ];


  const TOOL = {}, KEYS = {};
  for (const [, list] of GROUPS) for (const t of list) { TOOL[t.id] = t; if (t.key) KEYS[t.key] = t.id; }
  const SHAPES = new Set(['line', 'arrow', 'rect', 'ellipse', 'triangle', 'diamond', 'star']);
  const FREE = new Set(['pen', 'brush', 'marker', 'highlight', 'eraser']);


  const $ = (s) => document.querySelector(s);
  const say = (message, kind = 'ok', icon = '🎨') => { if (window.hiveToast) window.hiveToast(message, { kind, icon }); };
  const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  const hexToRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  const inkOn = (hex) => { const [r, g, b] = hexToRgb(hex); return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? INK : '#ffffff'; };


  const S = { tool: 'pen', color: INK, size: 6, opacity: 100, filled: false, dash: false, bg: 'white' };
  const hist = [];
  const redoStack = [];
  let root, cv, lctx, stage, drawing = null, pendingText = null;


  // ---------- building the editor ----------
  function buildUI(old) {
    const find = (name) => GROUPS.find((g) => g[0] === name)[1];
    const btn = (t) => `<button class="sk-tool" data-tool="${t.id}" title="${t.label}${t.key ? ' (' + t.key.toUpperCase() + ')' : ''}"><span class="ic">${t.icon}</span><span>${t.label}</span></button>`;
    const group = (name) => `
          <div class="sk-group" aria-label="${name}">
            <div class="sk-gl">${name}</div>
            <div class="sk-gbtns">${find(name).map(btn).join('')}</div>
          </div>`;

    root = document.createElement('div');
    root.id = 'skRoot';
    root.dataset.bg = S.bg;
    root.innerHTML = `
      <div class="sk-stage" id="skStage">
        <div class="sk-bg"></div>
        <canvas id="skCanvas" width="${W}" height="${H}"></canvas>
        <input id="skText" hidden autocomplete="off">
      </div>
      <div class="sk-hint" id="skHint"></div>

      <div class="sk-panel">
        <div class="sk-row sk-bar">
          ${group('Draw')}
          <span class="sk-sep"></span>
          ${group('Write')}
          <span class="sk-sep"></span>
          ${group('Fix')}
        </div>

        <details class="sk-folder" id="skFolder">
          <summary>
            <span>📐 Shapes</span>
            <span class="sk-fname" id="skShapeName"></span>
            <span class="sk-chev">▾</span>
          </summary>
          <div class="sk-shapes">${find('Shapes').map(btn).join('')}</div>
        </details>

        <div class="sk-row sk-colors">
          <div class="sk-swatches">
            ${PALETTE.map((c) => `<button class="sk-sw" data-col="${c}" style="background:${c}" title="${c}" aria-label="Colour ${c}"></button>`).join('')}
            <input type="color" id="skColor" value="${S.color}" title="Any colour">
          </div>
        </div>

        <div class="sk-row sk-settings">
          <label class="sk-lbl">Size <input type="range" id="skSize" min="1" max="60" value="${S.size}"><b id="skSizeV">${S.size}</b></label>
          <label class="sk-lbl">Opacity <input type="range" id="skOp" min="10" max="100" value="${S.opacity}"><b id="skOpV">${S.opacity}%</b></label>
          <button class="sk-t" data-sk="filled" title="Fill shapes with the colour">◼ Filled</button>
          <button class="sk-t" data-sk="dash" title="Dashed lines and outlines">┅ Dashed</button>
          <select id="skBg" title="Paper">
            <option value="white">White paper</option>
            <option value="paper">Grid paper</option>
            <option value="dark">Dark board</option>
          </select>
          <button class="sk-t" data-sk="undo" title="Undo (Ctrl+Z)">↶ Undo</button>
          <button class="sk-t" data-sk="redo" title="Redo (Ctrl+Y)">↷ Redo</button>
        </div>
      </div>`;
    old.style.display = 'none';
    old.parentNode.insertBefore(root, old);
    cv = root.querySelector('#skCanvas');
    stage = root.querySelector('#skStage');
    lctx = cv.getContext('2d', { willReadFrequently: true });
  }


  function wire() {
    root.addEventListener('click', (e) => {
      const tool = e.target.closest('[data-tool]');
      if (tool) {
        const id = tool.dataset.tool;
        setTool(id);
        if (SHAPES.has(id)) root.querySelector('#skFolder').open = false; // tidy up after picking a shape
        return;
      }
      const col = e.target.closest('[data-col]');
      if (col) return setColor(col.dataset.col);
      const sk = e.target.closest('[data-sk]');
      if (!sk) return;
      const a = sk.dataset.sk;
      if (a === 'undo') undo();
      else if (a === 'redo') redoAct();
      else if (a === 'filled') { S.filled = !S.filled; sk.classList.toggle('on', S.filled); }
      else if (a === 'dash') { S.dash = !S.dash; sk.classList.toggle('on', S.dash); }
    });


    root.querySelector('#skColor').addEventListener('input', (e) => setColor(e.target.value));
    root.querySelector('#skSize').addEventListener('input', (e) => {
      S.size = +e.target.value;
      root.querySelector('#skSizeV').textContent = S.size;
    });
    root.querySelector('#skOp').addEventListener('input', (e) => {
      S.opacity = +e.target.value;
      root.querySelector('#skOpV').textContent = S.opacity + '%';
    });
    root.querySelector('#skBg').addEventListener('change', (e) => setBg(e.target.value));


    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);


    const inp = root.querySelector('#skText');
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commitText(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelText(); }
    });
    inp.addEventListener('blur', () => { if (pendingText && inp.value.trim()) commitText(); });


    document.addEventListener('keydown', (e) => {
      if (!visible(root)) return;
      if (e.target.matches && e.target.matches('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); return e.shiftKey ? redoAct() : undo(); }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); return redoAct(); }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (KEYS[k]) setTool(KEYS[k]);
    });
  }


  // ---------- tools and settings ----------
  function setTool(id) {
    if (pendingText) commitText();
    S.tool = id;
    root.querySelectorAll('.sk-tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === id));
    root.querySelector('#skHint').textContent = TOOL[id].hint;

    // Show the active shape in the folder header, so you can see it while the folder is closed.
    const isShape = SHAPES.has(id);
    root.querySelector('#skShapeName').textContent = isShape ? '· ' + TOOL[id].label : '';
    root.querySelector('#skFolder > summary').classList.toggle('on', isShape);

    cv.style.cursor = (id === 'text' || id === 'note') ? 'text'
      : (id === 'fill' || id === 'pick') ? 'copy'
      : id === 'eraser' ? 'cell' : 'crosshair';
  }


  function setColor(c) {
    S.color = c;
    root.querySelector('#skColor').value = c;
    root.querySelectorAll('.sk-sw').forEach((b) => b.classList.toggle('on', b.dataset.col === c));
    if (S.tool === 'eraser') setTool('pen');
  }


  function setBg(v) {
    S.bg = v;
    root.dataset.bg = v;
    if (v === 'dark' && S.color === INK) setColor(CHALK);
    if (v !== 'dark' && S.color === CHALK) setColor(INK);
  }


  // ---------- history ----------
  function pushHistory(img) {
    hist.push(img);
    if (hist.length > MAX_HISTORY) hist.shift();
    redoStack.length = 0;
    refreshBtns();
  }


  function snapshot() { pushHistory(lctx.getImageData(0, 0, W, H)); }


  function undo() {
    if (!hist.length) return say('Nothing to undo.', 'info', '💭');
    redoStack.push(lctx.getImageData(0, 0, W, H));
    lctx.putImageData(hist.pop(), 0, 0);
    refreshBtns();
  }


  function redoAct() {
    if (!redoStack.length) return say('Nothing to redo.', 'info', '💭');
    hist.push(lctx.getImageData(0, 0, W, H));
    lctx.putImageData(redoStack.pop(), 0, 0);
    refreshBtns();
  }


  function refreshBtns() {
    if (!root) return;
    const u = root.querySelector('[data-sk="undo"]');
    const r = root.querySelector('[data-sk="redo"]');
    if (u) u.disabled = !hist.length;
    if (r) r.disabled = !redoStack.length;
  }


  function hasInk() {
    const d = lctx.getImageData(0, 0, W, H).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return true;
    return false;
  }


  function clearAll() {
    if (!hasInk()) return say('The sketch is already empty.', 'info', '💭');
    if (!confirm('Clear the whole sketch? You can still Undo.')) return;
    snapshot();
    lctx.clearRect(0, 0, W, H);
  }


  function resetEditor() {
    lctx.clearRect(0, 0, W, H);
    hist.length = 0;
    redoStack.length = 0;
    refreshBtns();
  }


  // ---------- drawing ----------
  function pos(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }


  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = pos(e);
    const t = S.tool;
    if (t === 'text' || t === 'note') return askText(e, p, t);
    if (t === 'fill') return floodFill(Math.round(p.x), Math.round(p.y));
    if (t === 'pick') return pickColour(p);
    cv.setPointerCapture(e.pointerId);
    drawing = { tool: t, start: p, pts: [p], base: lctx.getImageData(0, 0, W, H), moved: false };
  }


  function onMove(e) {
    if (!drawing) return;
    const p = pos(e);
    if (!drawing.moved && Math.hypot(p.x - drawing.start.x, p.y - drawing.start.y) < 1.5) return;
    drawing.moved = true;
    if (SHAPES.has(drawing.tool)) {
      lctx.putImageData(drawing.base, 0, 0);
      drawShape(drawing.tool, drawing.start, p, e.shiftKey);
    } else {
      drawing.pts.push(p);
      paintFree(drawing.base, e.shiftKey ? [drawing.start, p] : drawing.pts, drawing.tool);
    }
  }


  function onUp() {
    if (!drawing) return;
    const d = drawing;
    drawing = null;
    if (!d.moved && FREE.has(d.tool)) paintFree(d.base, [d.start], d.tool); // a click leaves a dot
    if (d.moved || FREE.has(d.tool)) pushHistory(d.base);
    refreshBtns();
  }


  function applyStroke(t) {
    const op = S.opacity / 100;
    lctx.lineCap = 'round';
    lctx.lineJoin = 'round';
    lctx.strokeStyle = S.color;
    lctx.fillStyle = S.color;
    lctx.globalCompositeOperation = 'source-over';
    lctx.globalAlpha = op;
    lctx.setLineDash([]);
    let w = S.size;
    if (t === 'brush') { w = S.size * 2.2; lctx.globalAlpha = op * 0.92; }
    if (t === 'marker') { w = S.size * 1.5; lctx.globalAlpha = op * 0.75; }
    if (t === 'highlight') { w = S.size * 3 + 6; lctx.globalAlpha = 0.35; }
    if (t === 'eraser') {
      w = S.size * 2.5;
      lctx.globalCompositeOperation = 'destination-out';
      lctx.globalAlpha = 1;
      lctx.strokeStyle = '#000';
      lctx.fillStyle = '#000';
    }
    lctx.lineWidth = w;
  }


  // Redraws the whole free stroke on top of the saved picture, so nothing doubles up.
  function paintFree(base, pts, tool) {
    lctx.putImageData(base, 0, 0);
    lctx.save();
    applyStroke(tool);
    lctx.beginPath();
    if (pts.length === 1) {
      lctx.arc(pts[0].x, pts[0].y, lctx.lineWidth / 2, 0, Math.PI * 2);
      lctx.fill();
    } else {
      lctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
        lctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const last = pts[pts.length - 1];
      lctx.lineTo(last.x, last.y);
      lctx.stroke();
    }
    lctx.restore();
  }


  function drawShape(t, a, b, shift) {
    const x1 = a.x, y1 = a.y;
    let x2 = b.x, y2 = b.y;
    lctx.save();
    lctx.globalAlpha = S.opacity / 100;
    lctx.globalCompositeOperation = 'source-over';
    lctx.strokeStyle = S.color;
    lctx.fillStyle = S.color;
    lctx.lineWidth = S.size;
    lctx.lineCap = 'round';
    lctx.lineJoin = 'round';
    lctx.setLineDash(S.dash ? [S.size * 2 + 6, S.size + 6] : []);
    lctx.beginPath();


    if (t === 'line' || t === 'arrow') {
      if (shift) {
        const step = Math.PI / 12;
        const ang = Math.round(Math.atan2(y2 - y1, x2 - x1) / step) * step;
        const len = Math.hypot(x2 - x1, y2 - y1);
        x2 = x1 + Math.cos(ang) * len;
        y2 = y1 + Math.sin(ang) * len;
      }
      lctx.moveTo(x1, y1);
      lctx.lineTo(x2, y2);
      lctx.stroke();
      if (t === 'arrow') {
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const hl = Math.max(14, S.size * 4);
        lctx.setLineDash([]);
        lctx.beginPath();
        lctx.moveTo(x2 - hl * Math.cos(ang - 0.45), y2 - hl * Math.sin(ang - 0.45));
        lctx.lineTo(x2, y2);
        lctx.lineTo(x2 - hl * Math.cos(ang + 0.45), y2 - hl * Math.sin(ang + 0.45));
        lctx.stroke();
      }
    } else {
      let w = x2 - x1, h = y2 - y1;
      if (shift && t !== 'star') {
        const m = Math.max(Math.abs(w), Math.abs(h));
        w = w < 0 ? -m : m;
        h = h < 0 ? -m : m;
      }
      const cx = x1 + w / 2, cy = y1 + h / 2;
      if (t === 'rect') lctx.rect(x1, y1, w, h);
      else if (t === 'ellipse') lctx.ellipse(cx, cy, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
      else if (t === 'triangle') {
        lctx.moveTo(cx, y1);
        lctx.lineTo(x1 + w, y1 + h);
        lctx.lineTo(x1, y1 + h);
        lctx.closePath();
      } else if (t === 'diamond') {
        lctx.moveTo(cx, y1);
        lctx.lineTo(x1 + w, cy);
        lctx.lineTo(cx, y1 + h);
        lctx.lineTo(x1, cy);
        lctx.closePath();
      } else if (t === 'star') {
        const R = Math.hypot(x2 - x1, y2 - y1), r = R * 0.45;
        for (let i = 0; i < 10; i++) {
          const ang = -Math.PI / 2 + i * Math.PI / 5;
          const rad = i % 2 ? r : R;
          const px = x1 + Math.cos(ang) * rad, py = y1 + Math.sin(ang) * rad;
          if (i === 0) lctx.moveTo(px, py);
          else lctx.lineTo(px, py);
        }
        lctx.closePath();
      }
      if (S.filled) lctx.fill();
      lctx.stroke();
    }
    lctx.restore();
  }


  // ---------- text and sticky notes ----------
  function askText(e, p, kind) {
    if (pendingText) commitText();
    const inp = root.querySelector('#skText');
    const sr = stage.getBoundingClientRect();
    inp.hidden = false;
    inp.value = '';
    inp.placeholder = kind === 'note' ? 'Type your note…' : 'Type text…';
    inp.style.left = Math.min(Math.max(0, sr.width - 170), Math.max(0, e.clientX - sr.left)) + 'px';
    inp.style.top = Math.min(Math.max(0, sr.height - 40), Math.max(0, e.clientY - sr.top)) + 'px';
    pendingText = { p, kind };
    setTimeout(() => inp.focus(), 0);
  }


  function cancelText() {
    pendingText = null;
    const inp = root.querySelector('#skText');
    inp.value = '';
    inp.hidden = true;
  }


  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }


  function commitText() {
    if (!pendingText) return;
    const inp = root.querySelector('#skText');
    const { p, kind } = pendingText;
    const txt = inp.value.trim();
    pendingText = null;
    inp.value = '';
    inp.hidden = true;
    if (!txt) return;


    snapshot();
    const size = Math.max(18, S.size * 3 + 14);
    lctx.save();
    lctx.globalCompositeOperation = 'source-over';
    lctx.globalAlpha = S.opacity / 100;
    lctx.font = `600 ${size}px system-ui, sans-serif`;
    lctx.textBaseline = 'top';
    if (kind === 'note') {
      const pad = size * 0.6;
      const w = lctx.measureText(txt).width + pad * 2;
      const h = size * 1.4 + pad;
      lctx.translate(p.x, p.y);
      lctx.rotate(-0.025);
      lctx.shadowColor = 'rgba(0,0,0,0.25)';
      lctx.shadowBlur = 12;
      lctx.shadowOffsetY = 4;
      lctx.fillStyle = S.color;
      rr(lctx, 0, 0, w, h, 10);
      lctx.fill();
      lctx.shadowColor = 'transparent';
      lctx.fillStyle = inkOn(S.color);
      lctx.fillText(txt, pad, pad * 0.55);
    } else {
      lctx.fillStyle = S.color;
      lctx.fillText(txt, p.x, p.y);
    }
    lctx.restore();
    refreshBtns();
  }


  // ---------- fill and colour picker ----------
  function floodFill(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const img = lctx.getImageData(0, 0, W, H);
    const d = img.data;
    const start = (y * W + x) * 4;
    const tr = d[start], tg = d[start + 1], tb = d[start + 2], ta = d[start + 3];
    const [fr, fg, fb] = hexToRgb(S.color);
    const fa = Math.round(255 * S.opacity / 100);
    if (tr === fr && tg === fg && tb === fb && ta === fa) return say('That area already has this colour.', 'info', '💭');


    const before = new Uint8ClampedArray(d);
    const match = (i) => Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) + Math.abs(d[i + 3] - ta) <= 40;
    const seen = new Uint8Array(W * H);
    const stack = [y * W + x];
    let filled = 0;
    while (stack.length) {
      const p = stack.pop();
      if (seen[p]) continue;
      seen[p] = 1;
      const i = p * 4;
      if (!match(i)) continue;
      d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = fa;
      filled++;
      const px = p % W;
      if (px > 0) stack.push(p - 1);
      if (px < W - 1) stack.push(p + 1);
      if (p >= W) stack.push(p - W);
      if (p < W * (H - 1)) stack.push(p + W);
    }
    if (!filled) return;
    pushHistory(new ImageData(before, W, H));
    lctx.putImageData(img, 0, 0);
  }


  function pickColour(p) {
    const [r, g, b, a] = lctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data;
    if (!a) return say('That spot is empty. Click on a coloured line or shape.', 'info', '💭');
    setColor(rgbToHex(r, g, b));
    setTool('pen');
    say('Colour picked. Back to the pen.', 'ok', '💧');
  }


  // ---------- saving ----------
  function exportCanvas() {
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const o = out.getContext('2d');
    o.fillStyle = BG[S.bg];
    o.fillRect(0, 0, W, H);
    if (S.bg === 'paper') {
      o.strokeStyle = 'rgba(0,0,0,0.07)';
      o.lineWidth = 1;
      o.beginPath();
      for (let x = 0; x <= W; x += 25) { o.moveTo(x + 0.5, 0); o.lineTo(x + 0.5, H); }
      for (let y = 0; y <= H; y += 25) { o.moveTo(0, y + 0.5); o.lineTo(W, y + 0.5); }
      o.stroke();
    }
    o.drawImage(cv, 0, 0);
    return out;
  }


  // Sends the picture to the same file input the app already uses for photos.
  function targetInput() {
    const idea = $('#ideaOverlay');
    if (visible(idea)) {
      const f = idea.querySelector('input[type="file"]');
      if (f) return f;
    }
    return $('#fileIn');
  }


  async function saveSketch() {
    if (!hasInk()) return say('Draw something first, then tap Add sketch.', 'info', '💭');
    const blob = await new Promise((res) => exportCanvas().toBlob(res, 'image/png'));
    const target = targetInput();
    if (!target) return say('Could not find where to add the sketch.', 'warn', '⚠️');
    const file = new File([blob], `sketch-${Date.now()}.png`, { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    target.files = dt.files;
    target.dispatchEvent(new Event('change', { bubbles: true }));
    resetEditor();
    $('#cancelSketch')?.click();
    say('Sketch added. Keep going with the idea.', 'done', '🎨');
  }


  // ---------- style ----------
  const CSS = `
#skRoot{display:flex;flex-direction:column;gap:10px;width:100%;color:var(--text,#eef2ff)}
#skRoot *{box-sizing:border-box}

#skRoot .sk-stage{position:relative;width:clamp(260px,calc((70vh - 190px) * 1.6),100%);aspect-ratio:1000/625;align-self:center;border-radius:12px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.35);touch-action:none;user-select:none}
#skRoot .sk-bg{position:absolute;inset:0}
#skRoot[data-bg="white"] .sk-bg{background:#ffffff}
#skRoot[data-bg="dark"] .sk-bg{background:#0f1a2e}
#skRoot[data-bg="paper"] .sk-bg{background-color:#fffdf5;background-image:linear-gradient(rgba(0,0,0,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.07) 1px,transparent 1px);background-size:2.5% 4%}
#skRoot #skCanvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#skRoot #skText{position:absolute;z-index:2;width:auto;min-width:160px;max-width:70%;padding:4px 8px;border-radius:8px;border:2px solid var(--accent,#ffb800);background:#fff;color:#111827;font:600 16px system-ui,sans-serif;outline:none}
#skRoot .sk-hint{font-size:13px;color:var(--muted,#8b97b5);text-align:center;min-height:1.4em}

#skRoot .sk-panel{display:flex;flex-direction:column;gap:0;width:100%;border:1px solid var(--line,#22304a);border-radius:14px;background:#0b1424;overflow:hidden}
#skRoot .sk-row{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;justify-content:center;padding:10px 12px;font-size:12px;color:var(--muted,#8b97b5)}
#skRoot .sk-row + .sk-row,
#skRoot .sk-folder + .sk-row,
#skRoot .sk-bar + .sk-folder{border-top:1px solid var(--line,#22304a)}

#skRoot .sk-bar{align-items:flex-start;gap:10px}
#skRoot .sk-group{display:flex;flex-direction:column;align-items:center;gap:5px}
#skRoot .sk-gl{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#8b97b5)}
#skRoot .sk-gbtns{display:flex;gap:4px;flex-wrap:wrap;justify-content:center}
#skRoot .sk-sep{width:1px;align-self:stretch;background:var(--line,#22304a)}
#skRoot .sk-tool{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:54px;padding:6px;border-radius:12px;border:1px solid var(--line,#22304a);background:#111b2e;color:var(--text,#eef2ff);cursor:pointer;font:inherit;font-size:11px;transition:transform .15s,background .15s,border-color .15s}
#skRoot .sk-tool .ic{font-size:18px;line-height:1.1}
#skRoot .sk-tool:hover{transform:translateY(-2px);border-color:var(--accent,#ffb800)}
#skRoot .sk-tool.on{background:var(--accent,#ffb800);color:#1a1200;border-color:var(--accent,#ffb800);font-weight:700}
#skRoot .sk-tool.on .ic{animation:skPop .4s ease}

#skRoot .sk-folder{background:#0b1424}
#skRoot .sk-folder > summary{list-style:none;display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text,#eef2ff);user-select:none}
#skRoot .sk-folder > summary::-webkit-details-marker{display:none}
#skRoot .sk-folder > summary:hover{color:var(--accent,#ffb800)}
#skRoot .sk-folder > summary.on{color:var(--accent,#ffb800)}
#skRoot .sk-fname{font-size:12px;font-weight:600;color:var(--accent,#ffb800)}
#skRoot .sk-chev{margin-left:auto;color:var(--muted,#8b97b5);transition:transform .2s}
#skRoot .sk-folder[open] .sk-chev{transform:rotate(180deg)}
#skRoot .sk-shapes{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:4px 12px 12px}

#skRoot .sk-swatches{display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:center}
#skRoot .sk-sw{width:20px;height:20px;border-radius:50%;border:2px solid #0b1424;cursor:pointer;padding:0;box-shadow:0 0 0 1px var(--line,#22304a);transition:transform .15s}
#skRoot .sk-sw:hover{transform:scale(1.15)}
#skRoot .sk-sw.on{box-shadow:0 0 0 2px var(--accent,#ffb800)}
#skRoot input[type=color]{width:28px;height:28px;border:0;background:none;padding:0;cursor:pointer}
#skRoot input[type=range]{width:110px;margin:0}
#skRoot .sk-lbl{display:flex;gap:6px;align-items:center}
#skRoot .sk-lbl b{min-width:34px;color:var(--text,#eef2ff);font-variant-numeric:tabular-nums}
#skRoot .sk-t{padding:6px 10px;border-radius:10px;border:1px solid var(--line,#22304a);background:#111b2e;color:var(--text,#eef2ff);cursor:pointer;font:inherit;font-size:12px}
#skRoot .sk-t.on{background:var(--accent,#ffb800);color:#1a1200;border-color:var(--accent,#ffb800)}
#skRoot .sk-t:disabled{opacity:.35;cursor:default}
#skRoot select{background:#111b2e;color:var(--text,#eef2ff);border:1px solid var(--line,#22304a);border-radius:10px;padding:5px 8px;font:inherit;font-size:12px}

@keyframes skPop{50%{transform:scale(1.25)}}
@media (prefers-reduced-motion: reduce){#skRoot *{animation:none!important;transition:none!important}}
`;


  // ---------- start ----------
  function init() {
    const old = $('#sketchCanvas');
    if (!old) { console.warn('[hive sketch] sketch canvas not found'); return; }


    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);


    buildUI(old);
    wire();
    setColor(S.color);
    setTool('pen');
    refreshBtns();


    // Our buttons replace the old ones. Cancel still closes the window as before.
    document.addEventListener('click', (e) => {
      if (!e.target.closest) return;
      if (e.target.closest('#saveSketch')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        saveSketch();
      } else if (e.target.closest('#clearSketch')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        clearAll();
      }
    }, true);


    window.hiveSketch = { clear: clearAll, save: saveSketch };
  }


  init();
})();