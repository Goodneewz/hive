/* Hive: diagram-style game pictures and a fixed jigsaw board.
   Loads after arcade.js. Replaces withArt (the picture) and fixes the jigsaw layout. */

const HV_ART_PAL = [
  { bg: '#f4f6fb', dot: 'rgba(29,58,110,0.08)', ink: '#1d3a6e', idea: '#ffd166', side: '#bde0fe', good: '#caffbf', warm: '#ffd6e0' },
  { bg: '#eef7f4', dot: 'rgba(7,59,76,0.08)', ink: '#073b4c', idea: '#06d6a0', side: '#ffe5b4', good: '#d8e2ff', warm: '#ffd6e0' },
  { bg: '#f7f1ff', dot: 'rgba(29,58,110,0.07)', ink: '#1d3a6e', idea: '#ffb703', side: '#cdeafe', good: '#d9f7c4', warm: '#ffd0d0' }
];

// Replaces the old picture. Same signature, so every game that calls withArt gets the diagram.
function withArt(idea, variant, w, h, cb) {
  cb(hvDiagramArt(idea, variant));
}

// Fits text into a box, adding an ellipsis when it is cut short.
function fitLines(g, text, maxW, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const out = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width <= maxW) { cur = t; continue; }
    out.push(cur);
    cur = w;
    if (out.length === maxLines) { cur = ''; break; }
  }
  if (out.length < maxLines && cur) out.push(cur);
  if (out.length === maxLines && out.join(' ') !== words.join(' ')) {
    let last = out[maxLines - 1];
    while (last && g.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    out[maxLines - 1] = last.trimEnd() + '…';
  }
  return out;
}

// Draws a diagram from the idea: the idea in the centre, with why, steps, who, and done-when around it.
function hvDiagramArt(idea, variant) {
  const W = 480, H = 480;
  const pal = HV_ART_PAL[Math.abs(Math.floor(Number(variant) || 0)) % HV_ART_PAL.length];
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = H;
  const g = cvs.getContext('2d');
  const ff = '"Segoe UI", Arial, sans-serif';
  const emo = '"Segoe UI Emoji", "Segoe UI", Arial, sans-serif';

  g.fillStyle = pal.bg; g.fillRect(0, 0, W, H);
  g.fillStyle = pal.dot;
  for (let x = 12; x < W; x += 24) {
    for (let y = 12; y < H; y += 24) { g.beginPath(); g.arc(x, y, 1.5, 0, Math.PI * 2); g.fill(); }
  }

  const ans = (idea && idea.assist && idea.assist.answers) || {};
  const clar = (idea && idea.clarify) || {};
  const tasks = (idea && idea.tasks) || [];
  const doneCount = tasks.filter(t => t.done).length;
  const title = (idea && idea.title) || 'Your idea';
  const openTasks = tasks.filter(t => !t.done).map(t => t.text);
  const steps = (openTasks.length ? openTasks : tasks.map(t => t.text)).slice(0, 2).join(' · ');
  const why = ans.why || clar.why || (idea && idea.body) || 'Why it matters';
  const who = ans.people || clar.people || 'Who it is for';
  const goal = ans.done || clar.done || (tasks.length ? `${doneCount} of ${tasks.length} steps done` : 'Done when it works');

  function box(x, y, w, h, fill, icon, label, text) {
    g.fillStyle = fill; g.strokeStyle = pal.ink; g.lineWidth = 3;
    g.beginPath(); g.roundRect(x, y, w, h, 16); g.fill(); g.stroke();
    g.textAlign = 'center'; g.fillStyle = pal.ink;
    g.font = `24px ${emo}`; g.fillText(icon, x + w / 2, y + 32);
    g.font = `bold 14px ${ff}`; g.fillText(label, x + w / 2, y + 54);
    g.font = `12px ${ff}`;
    fitLines(g, text, w - 16, 2).forEach((ln, j) => g.fillText(ln, x + w / 2, y + 72 + j * 15));
  }

  function arrow(x1, y1, x2, y2) {
    g.strokeStyle = pal.ink; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    g.fillStyle = pal.ink; g.beginPath(); g.moveTo(x2, y2);
    g.lineTo(x2 - 12 * Math.cos(a - 0.45), y2 - 12 * Math.sin(a - 0.45));
    g.lineTo(x2 - 12 * Math.cos(a + 0.45), y2 - 12 * Math.sin(a + 0.45));
    g.closePath(); g.fill();
  }

  arrow(240, 118, 240, 190);
  arrow(240, 290, 240, 362);
  arrow(144, 240, 172, 240);
  arrow(308, 240, 336, 240);

  box(172, 18, 136, 100, pal.good, '🎯', 'Why', why);
  box(172, 362, 136, 100, pal.warm, '🏁', 'Done when', goal);
  box(10, 190, 134, 100, pal.side, '🗺️', 'Steps', steps || 'Add steps');
  box(336, 190, 134, 100, pal.side, '👥', 'Who', who);
  box(172, 190, 136, 100, pal.idea, '💡', 'Idea', title);

  return cvs;
}

// Jigsaw layout fix: styles the board and tray, and sets the grid so pieces line up.
(function () {
  const css = document.createElement('style');
  css.id = 'hvJigFix';
  css.textContent = `
    .arc-jig-ref{text-align:center;margin:8px auto 4px}
    .arc-jig-ref img{width:120px;height:120px;object-fit:cover;border-radius:12px;display:block;margin:0 auto}
    .arc-jig-ref span{display:block;font-size:12px;opacity:.7;margin-top:4px}
    .arc-jig-tray{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin:14px auto 0;min-height:120px;max-width:560px}
    .arc-jig-tray .arc-jig-p{position:relative;width:110px;height:110px;cursor:grab;touch-action:none}
    .arc-jig-tray .arc-jig-p canvas{width:100%;height:100%;display:block}
    .arc-jig-p.dragging{position:fixed!important;z-index:999;width:110px!important;height:110px!important}
    .arc-jig-p.locked{cursor:default}
  `;
  document.head.appendChild(css);

  function fixBoards() {
    document.querySelectorAll('.arc-jig-board').forEach(b => {
      if (b.dataset.hvFixed) return;
      const slots = b.querySelectorAll('.arc-jig-slot');
      if (!slots.length) return;
      b.dataset.hvFixed = '1';
      const k = Math.round(Math.sqrt(slots.length));
      const W = parseFloat(b.style.width) || 360;
      const cell = W / k;
      b.style.boxSizing = 'border-box';
      b.style.display = 'grid';
      b.style.position = 'relative';
      b.style.padding = '0';
      b.style.gap = '0';
      b.style.width = W + 'px';
      b.style.height = W + 'px';
      b.style.margin = '0 auto';
      b.style.gridTemplateColumns = `repeat(${k}, ${cell}px)`;
      slots.forEach(s => { s.style.width = cell + 'px'; s.style.height = cell + 'px'; });
    });
  }

  new MutationObserver(fixBoards).observe(document.body, { childList: true, subtree: true });
  fixBoards();
})();