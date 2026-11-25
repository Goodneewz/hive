// Voice note: record, pause, resume, stop.
// Works on Capture (new idea) and inside an open idea.
(() => {
  let rec = null, chunks = [], stream = null, timer = null;
  let elapsed = 0, segStart = 0, state = 'idle';

  const $ = (s) => document.querySelector(s);
  const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;

  // Attach to the idea window when it is open. Otherwise attach to Capture's pending list.
  function fileInput() {
    const idea = $('#ideaOverlay');
    if (visible(idea)) {
      const f = idea.querySelector('input[type="file"]');
      if (f) return f;
    }
    return $('#fileIn');
  }

  function mmss(ms) {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function currentMs() {
    return state === 'rec' ? elapsed + (Date.now() - segStart) : elapsed;
  }

  function canPause() {
    return !!rec && typeof rec.pause === 'function' && typeof rec.resume === 'function';
  }

  // Draws the buttons in every voice bar for the current state.
  function render() {
    document.querySelectorAll('.hv-vbar').forEach((bar) => {
      const cls = bar.dataset.cls || '';
      const btn = (action, text) =>
        `<button type="button" class="${cls} hv-vb" data-hv-voice="${action}">${text}</button>`;

      if (state === 'idle') {
        bar.innerHTML = btn('start', '🎙 + Voice note');
        return;
      }
      const dot = state === 'rec'
        ? '<span class="hv-rec-dot">🔴</span>'
        : '<span>⏸</span>';
      let html = `<span class="hv-vtime">${dot} <span class="hv-vtime-num">${mmss(currentMs())}</span></span>`;
      if (state === 'rec' && canPause()) html += btn('pause', '⏸ Pause');
      if (state === 'paused') html += btn('resume', '▶ Resume');
      html += btn('stop', '⏹ Stop');
      bar.innerHTML = html;
    });
  }

  function tick() {
    document.querySelectorAll('.hv-vtime-num').forEach((el) => { el.textContent = mmss(currentMs()); });
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(tick, 300);
  }

  function stopTimer() {
    clearInterval(timer);
    timer = null;
  }

  async function start() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      window.hiveToast?.('I need the microphone to record. Allow it in your browser settings and try again.', { kind: 'warn', icon: '⚠️' });
      return;
    }
    chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
      : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => finish(rec.mimeType || mime || 'audio/webm');
    rec.start(1000);

    elapsed = 0;
    segStart = Date.now();
    state = 'rec';
    render();
    startTimer();
  }

  function pause() {
    if (!rec || state !== 'rec' || !canPause()) return;
    rec.pause();
    elapsed += Date.now() - segStart;
    state = 'paused';
    stopTimer();
    render();
  }

  function resume() {
    if (!rec || state !== 'paused') return;
    rec.resume();
    segStart = Date.now();
    state = 'rec';
    render();
    startTimer();
  }

  function stop() {
    if (!rec) return;
    if (state === 'rec') elapsed += Date.now() - segStart;
    stopTimer();
    if (rec.state !== 'inactive') rec.stop(); // triggers finish()
    else finish(rec.mimeType || 'audio/webm');
  }

  function finish(mime) {
    stopTimer();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    rec = null;
    state = 'idle';
    render();

    const blob = new Blob(chunks, { type: mime });
    chunks = [];
    if (!blob.size) {
      window.hiveToast?.('The recording was empty. Try again.', { kind: 'warn', icon: '⚠️' });
      return;
    }
    const ext = mime.includes('mp4') ? 'm4a' : 'webm';
    const file = new File([blob], 'voice-note-' + Date.now() + '.' + ext, { type: mime });

    const input = fileInput();
    if (!input) {
      window.hiveToast?.('Could not attach the voice note. Try again.', { kind: 'warn', icon: '⚠️' });
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    window.hiveToast?.('Voice note added. Play it any time.', { kind: 'done', icon: '🎉' });
  }

  // One click handler for every voice button.
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-hv-voice]');
    if (!b) return;
    const a = b.dataset.hvVoice;
    if (a === 'start') start();
    else if (a === 'pause') pause();
    else if (a === 'resume') resume();
    else if (a === 'stop') stop();
  });

  // Adds a voice bar after the Sketch button on Capture, and after + Sketch inside an open idea.
  function inject() {
    const anchors = [];
    const cap = $('#sketchBtn');
    if (cap) anchors.push(cap);
    const idea = $('#ideaBody');
    if (idea) {
      const sk = [...idea.querySelectorAll('button')].find((b) => /\+\s*Sketch/.test(b.textContent));
      if (sk) anchors.push(sk);
    }

    let added = false;
    for (const el of anchors) {
      const next = el.nextElementSibling;
      if (next && next.classList.contains('hv-vbar')) continue;
      const bar = document.createElement('span');
      bar.className = 'hv-vbar';
      bar.dataset.cls = el.className;
      el.after(bar);
      added = true;
    }
    if (added) render();
  }

  const css = document.createElement('style');
  css.textContent = `
#recBtn{display:none!important}
.hv-vbar{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;margin-left:6px;vertical-align:middle}
.hv-vtime{font-size:13px;font-weight:600;color:#f87171;font-variant-numeric:tabular-nums;display:inline-flex;gap:4px;align-items:center}
.hv-rec-dot{animation:hvPulse 1.2s ease-in-out infinite}
@keyframes hvPulse{50%{opacity:.4}}
@media (prefers-reduced-motion: reduce){.hv-rec-dot{animation:none}}`;
  document.head.appendChild(css);

  new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
  inject();
})();