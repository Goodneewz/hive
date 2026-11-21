/* welcome.js — first-visit sign-up screen for Hive.
   Shows once per browser, and never for someone already signed in.
   Uses the sign-in box from push.js (window.hivePush.openAccount). */
(() => {
  'use strict';
  const FLAG = 'hive-welcomed';

  const CSS = `
.hw-ov{position:fixed;inset:0;z-index:1100;display:none;align-items:center;justify-content:center;padding:16px;background:radial-gradient(circle at 30% 20%,rgba(255,184,0,.18),transparent 45%),rgba(3,8,16,.88);overflow:auto}
.hw-ov.open{display:flex;animation:hw-fade .4s ease}
.hw-card{width:min(440px,100%);background:#0F1B2E;color:#F4EFD8;border:1px solid rgba(255,184,0,.35);border-radius:22px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.5);animation:hw-rise .5s cubic-bezier(.2,.8,.2,1)}
.hw-bee{font-size:2.6rem;display:inline-block;animation:hw-bob 2.2s ease-in-out infinite}
.hw-card h2{margin:6px 0 4px;font-size:1.5rem;background:linear-gradient(90deg,#FFB800,#FF7A59);-webkit-background-clip:text;background-clip:text;color:transparent}
.hw-sub{opacity:.8;line-height:1.5;margin:0 0 14px}
.hw-in{display:block;width:100%;box-sizing:border-box;margin:6px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:#0A1424;color:inherit;font-size:1rem}
.hw-in:focus{outline:none;border-color:#FFB800;box-shadow:0 0 0 3px rgba(255,184,0,.2)}
.hw-btn{display:block;width:100%;box-sizing:border-box;margin:8px 0;padding:13px;border-radius:14px;border:0;font-size:1rem;font-weight:800;cursor:pointer;transition:transform .15s,box-shadow .2s}
.hw-btn:hover{transform:translateY(-2px)}
.hw-google{background:#F4EFD8;color:#050F1E}
.hw-main{background:linear-gradient(135deg,#FFB800,#FFD84D);color:#050F1E;box-shadow:0 8px 22px rgba(255,184,0,.3)}
.hw-alt{background:none;color:#F4EFD8;border:1px solid rgba(255,255,255,.25)}
.hw-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.hw-row .hw-btn{margin:4px 0 0}
.hw-or{display:flex;align-items:center;gap:10px;font-size:.8rem;opacity:.6;margin:12px 0 4px;text-transform:uppercase;letter-spacing:.1em}
.hw-or::before,.hw-or::after{content:"";flex:1;height:1px;background:rgba(255,255,255,.15)}
.hw-note{font-size:.85rem;opacity:.65;margin-top:10px;line-height:1.4}
.hw-msg{min-height:1.2em;color:#FF9A8B;font-size:.9rem;margin:6px 0}
.hw-anon{background:none;border:0;color:#F4EFD8;opacity:.75;text-decoration:underline;cursor:pointer;padding:8px;margin-top:6px;font-size:.92rem}
@keyframes hw-fade{from{opacity:0}to{opacity:1}}
@keyframes hw-rise{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}
@keyframes hw-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@media (prefers-reduced-motion: reduce){.hw-ov,.hw-card,.hw-bee{animation:none}}`;

  const LABELS = { google: 'Continue with Google', signup: 'Create account', signin: 'Sign in' };
  let ov, msg, emailIn, passIn;

  function build() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);

    ov = document.createElement('div');
    ov.className = 'hw-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Welcome to Hive');
    ov.innerHTML = `
      <div class="hw-card">
        <span class="hw-bee">🐝</span>
        <h2>Welcome to Hive</h2>
        <p class="hw-sub">Your ideas and reminders can follow you to any device. Pick how you want to start.</p>
        <button class="hw-btn hw-google" data-act="google">🔐 Continue with Google</button>
        <div class="hw-or">or use email</div>
        <input class="hw-in" id="hwEmail" type="email" placeholder="Email" autocomplete="email">
        <input class="hw-in" id="hwPass" type="password" placeholder="Password (6+ characters)" autocomplete="new-password">
        <div class="hw-msg" id="hwMsg"></div>
        <div class="hw-row">
          <button class="hw-btn hw-main" data-act="signup">✨ Sign up</button>
          <button class="hw-btn hw-alt" data-act="signin">Sign in</button>
        </div>
        <div style="text-align:center">
          <button class="hw-anon" data-act="anon">Continue anonymously (this device only)</button>
        </div>
        <p class="hw-note">Anonymous ideas stay on this phone and can't sync. You can sign up any time from the 👤 button at the top.</p>
      </div>`;
    document.body.append(ov);

    msg = ov.querySelector('#hwMsg');
    emailIn = ov.querySelector('#hwEmail');
    passIn = ov.querySelector('#hwPass');
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b) act(b.dataset.act);
    });
  }

  function finish() {
    try { localStorage.setItem(FLAG, '1'); } catch (e) { /* storage blocked */ }
    ov.classList.remove('open');
  }

  // True when push.js reports a signed-in account (not anonymous).
  function alreadySignedIn() {
    return document.body.dataset.account === 'in';
  }

  // Opens the sign-in box from push.js and returns it.
  function openBox() {
    if (!window.hivePush || typeof window.hivePush.openAccount !== 'function') return null;
    window.hivePush.openAccount();
    return document.getElementById('accountOverlay');
  }

  function boxButton(box, label) {
    return [...box.querySelectorAll('button')].find(b => b.textContent.trim().includes(label));
  }

  function act(name) {
    msg.textContent = '';

    if (name === 'anon') {
      // push.js signs the device in anonymously in the background.
      finish();
      return;
    }

    const email = emailIn.value.trim();
    const pass = passIn.value;
    if (name !== 'google' && (!email || pass.length < 6)) {
      msg.textContent = 'Enter your email and a password of at least 6 characters.';
      return;
    }

    const box = openBox();
    if (!box) {
      msg.textContent = 'Still loading. Try again in a moment.';
      return;
    }

    // Fills the sign-in box (if needed) and presses the matching button.
    const press = () => {
      if (name !== 'google') {
        const e = box.querySelector('input[type="email"]');
        const p = box.querySelector('input[type="password"]');
        if (!e || !p) return false;
        e.value = email;
        p.value = pass;
      }
      const btn = boxButton(box, LABELS[name]);
      if (!btn) return false;
      btn.click();
      return true;
    };

    finish();
    if (!press()) setTimeout(press, 120);
  }

  function maybeShow() {
    if (alreadySignedIn()) { finish(); return; }
    let seen = false;
    try { seen = localStorage.getItem(FLAG) === '1'; } catch (e) { /* ignore */ }
    if (!seen) ov.classList.add('open');
  }

  function init() {
    build();
    setTimeout(maybeShow, 600); // give push.js time to set up
    window.hiveWelcome = { show: () => ov.classList.add('open') };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();