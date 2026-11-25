// Voice note button inside the idea window (next to + Sketch)
(() => {
  let rec = null, chunks = [], timer = null, startedAt = 0, stream = null;

  function fileInput() {
    return document.querySelector('#ideaBody input[type=file]') || document.querySelector('#fileIn');
  }

  function mmss(ms) {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function setLabel(text) {
    const b = document.getElementById('hvVoice');
    if (b) b.textContent = text;
  }

  async function start() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      window.hiveToast?.("I need the microphone to record. Allow it in your browser settings and try again.", { kind: 'warn', icon: '⚠️' });
      return;
    }
    chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
      : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => finish(rec.mimeType || mime || 'audio/webm');
    rec.start();
    startedAt = Date.now();
    const b = document.getElementById('hvVoice');
    if (b) b.classList.add('hv-rec');
    clearInterval(timer);
    timer = setInterval(() => setLabel('⏹ Stop ' + mmss(Date.now() - startedAt)), 500);
    setLabel('⏹ Stop 0:00');
  }

  function stop() {
    if (rec && rec.state === 'recording') rec.stop();
  }

  function finish(mime) {
    clearInterval(timer);
    if (stream) stream.getTracks().forEach(t => t.stop());
    const b = document.getElementById('hvVoice');
    if (b) { b.classList.remove('hv-rec'); b.textContent = '🎙 + Voice note'; }

    const blob = new Blob(chunks, { type: mime });
    const ext = mime.includes('mp4') ? 'm4a' : 'webm';
    const file = new File([blob], 'voice-note-' + Date.now() + '.' + ext, { type: mime });

    const input = fileInput();
    if (!input) {
      window.hiveToast?.("Could not attach the voice note. Try again.", { kind: 'warn', icon: '⚠️' });
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    window.hiveToast?.("Voice note added to this idea. Play it any time.", { kind: 'done', icon: '🎉' });
  }

  function inject() {
    const sk = [...document.querySelectorAll('#ideaBody button')].find(b => /\+\s*Sketch/.test(b.textContent));
    if (!sk || document.getElementById('hvVoice')) return;
    const b = document.createElement('button');
    b.id = 'hvVoice';
    b.type = 'button';
    b.className = sk.className;
    b.textContent = '🎙 + Voice note';
    b.onclick = () => (rec && rec.state === 'recording') ? stop() : start();
    sk.after(b);
  }

  new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
  inject();
})();