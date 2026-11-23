// push.js: Hive accounts, silent automatic sync, reminders
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup, linkWithPopup, linkWithCredential,
  signInWithCredential, GoogleAuthProvider, EmailAuthProvider, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where,
  writeBatch, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getMessaging, getToken, isSupported } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDAf5AXYGqDrnZ1eeaBTU4yz2wkgzLNZXI',
  authDomain: 'hive-arc.firebaseapp.com',
  projectId: 'hive-arc',
  storageBucket: 'hive-arc.firebasestorage.app',
  messagingSenderId: '332100908160',
  appId: '1:332100908160:web:319f2097a5e095fd50e265',
  measurementId: 'G-4D13YMBZ26'
};
const VAPID_KEY = 'BEEM2pD3Cw3tD_co_ytjt8ylw_ax5i39WXN7Napza0PYQd-QxZABETd9LZOCHC7kzHOjWZbqJ7RhmkdqkqhKLfE';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const BLOB_PREFIX = 'hive-blob:';
const CHUNK = 900000;
const blobCache = new Map();
let syncing = false;
let syncAgain = false;
let deferredSince = 0;
let saveTimer = null;
let syncStatus = 'idle';
let lastSynced = localStorage.getItem('hive-synced-time') || '';

const CSS = `
.hk-av{width:34px;height:34px;border-radius:50%;border:2px solid var(--accent,#ffb800);background:var(--chip,#1d2a45);color:var(--text,#eef2ff);font-weight:800;cursor:pointer;padding:0;overflow:hidden;display:grid;place-items:center;font-size:15px}
.hk-av img,.hk-big img{width:100%;height:100%;object-fit:cover;display:block}
body[data-account="out"] .hk-av{border-style:dashed}
.hk-ov{position:fixed;inset:0;background:rgba(3,7,18,.72);display:none;align-items:center;justify-content:center;padding:16px;z-index:80}
.hk-ov.show{display:flex}
.hk-modal{background:var(--panel,#111b2e);border:1px solid var(--line,#22304a);border-radius:18px;padding:20px;width:min(420px,100%);color:var(--text,#eef2ff);animation:hkIn .25s ease;max-height:90vh;overflow:auto}
.hk-modal h3{margin:0 0 8px}
.hk-modal input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--line,#22304a);background:#0b1424;color:var(--text,#eef2ff);margin:6px 0}
.hk-big{width:84px;height:84px;border-radius:50%;border:2px solid var(--accent,#ffb800);background:var(--chip,#1d2a45);color:var(--text,#eef2ff);font-size:32px;font-weight:800;cursor:pointer;padding:0;overflow:hidden;flex:none}
.hk-small{font-size:12px;color:var(--muted,#8b97b5);margin:6px 0}
@keyframes hkIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
`;

// ---------- small helpers ----------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const say = (message, kind = 'info', icon = '🐝') => (window.hiveToast ? window.hiveToast(message, { kind, icon }) : console.log('[hive]', message));
const num = (x) => (typeof x === 'number' && isFinite(x) ? x : 0);
const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const stamp = (i) => { const t = new Date(i.createdAt).getTime(); return isNaN(t) ? 0 : t; };

function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) if (v[k] !== undefined) o[k] = sortKeys(v[k]);
    return o;
  }
  return v;
}
const canonical = (v) => JSON.stringify(sortKeys(v));

// ---------- attachments: packed for the cloud, restored on this device ----------
function blobToDataURL(b) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

// Replaces Blobs and large data URLs with small references. Saves the data into `blobs`.
async function pack(v, blobs) {
  if (v instanceof Blob) {
    const data = await blobToDataURL(v);
    const h = hash(data);
    blobs[h] = data;
    return { __blob: h, t: v.type || '' };
  }
  if (typeof v === 'string') {
    if (v.length > 300 && v.startsWith('data:')) {
      const h = hash(v);
      blobs[h] = v;
      return BLOB_PREFIX + h;
    }
    return v;
  }
  if (Array.isArray(v)) {
    const out = [];
    for (const x of v) out.push(await pack(x, blobs));
    return out;
  }
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) if (v[k] !== undefined) out[k] = await pack(v[k], blobs);
    return out;
  }
  return v;
}

// Puts the real attachments back in place of the references.
async function unpack(v, ctx) {
  if (typeof v === 'string') return v.startsWith(BLOB_PREFIX) ? blobData(v.slice(BLOB_PREFIX.length), ctx) : v;
  if (Array.isArray(v)) {
    const out = [];
    for (const x of v) out.push(await unpack(x, ctx));
    return out;
  }
  if (v && typeof v === 'object') {
    if (typeof v.__blob === 'string') {
      const data = await blobData(v.__blob, ctx);
      return fetch(data).then((r) => r.blob());
    }
    const out = {};
    for (const k of Object.keys(v)) out[k] = await unpack(v[k], ctx);
    return out;
  }
  return v;
}

async function blobData(h, ctx) {
  if (ctx.local[h]) return ctx.local[h];
  if (!blobCache.has(h)) blobCache.set(h, await fetchBlob(ctx.uid, h));
  return blobCache.get(h);
}

async function fetchBlob(uid, h) {
  const snap = await getDocs(query(collection(db, 'users', uid, 'blobs'), where('h', '==', h)));
  if (snap.empty) throw new Error('An attachment is not downloaded yet. Sync will retry.');
  const parts = snap.docs.map((d) => d.data()).sort((a, b) => a.i - b.i);
  if (parts.length !== parts[0].n) throw new Error('An attachment is incomplete. Sync will retry.');
  return parts.map((p) => p.data).join('');
}

async function uploadBlob(uid, h, data) {
  const n = Math.max(1, Math.ceil(data.length / CHUNK));
  const jobs = [];
  for (let i = 0; i < n; i++) {
    jobs.push(setDoc(doc(db, 'users', uid, 'blobs', `${h}_${i}`), { h, i, n, data: data.slice(i * CHUNK, (i + 1) * CHUNK) }));
  }
  await Promise.all(jobs);
}

// ---------- merge: never drops something one side still has ----------
const baseKey = (uid) => `hive-base-${uid}`;
const loadBase = (uid) => readJSON(baseKey(uid), { ideas: {} });
const saveBase = (uid, b) => localStorage.setItem(baseKey(uid), JSON.stringify(b));
const uploadedKey = (uid) => `hive-blobs-${uid}`;
const loadUploaded = (uid) => new Set(readJSON(uploadedKey(uid), []));
const saveUploaded = (uid, set) => localStorage.setItem(uploadedKey(uid), JSON.stringify([...set]));

function baseFrom(M) {
  const ideas = {};
  for (const i of M.ideas || []) ideas[i.id] = hash(canonical(i));
  return { ideas };
}

function mergeStates(L, C, base) {
  const out = {};
  for (const k of new Set([...Object.keys(L), ...Object.keys(C)])) {
    if (k === 'ideas') continue;
    if (k === 'days') out.days = mergeDays(L.days || {}, C.days || {});
    else if (k === 'xp' || k === 'focus') out[k] = Math.max(num(L[k]), num(C[k]));
    else out[k] = L[k] !== undefined ? L[k] : C[k];
  }
  out.ideas = mergeIdeas(L.ideas || [], C.ideas || [], base.ideas || {});
  return out;
}

function mergeDays(L, C) {
  const out = {};
  for (const d of new Set([...Object.keys(L), ...Object.keys(C)])) {
    const a = L[d] || {}, b = C[d] || {};
    const m = { ...b };
    for (const k of Object.keys(a)) {
      const av = a[k], bv = b[k];
      if (typeof av === 'number') m[k] = Math.max(av, typeof bv === 'number' ? bv : 0);
      else if (av !== undefined && av !== null && av !== '') m[k] = av;
    }
    out[d] = m;
  }
  return out;
}

function mergeIdeas(LI, CI, BI) {
  const lm = new Map(LI.map((i) => [i.id, i]));
  const cm = new Map(CI.map((i) => [i.id, i]));
  const out = [];
  for (const id of new Set([...lm.keys(), ...cm.keys()])) {
    const l = lm.get(id), c = cm.get(id), b = BI[id];
    let pick;
    if (l && !c) {
      // Only on this device. Keep it, unless the other device deleted it and this device did not edit it.
      pick = (b === undefined || hash(canonical(l)) !== b) ? l : null;
    } else if (c && !l) {
      // Only on the cloud. Keep it, unless this device deleted it and the cloud did not change it.
      pick = (b === undefined || hash(canonical(c)) !== b) ? c : null;
    } else {
      const lh = hash(canonical(l)), ch = hash(canonical(c));
      if (lh === ch) pick = l;
      else {
        const localChanged = b === undefined || lh !== b;
        const cloudChanged = b === undefined || ch !== b;
        if (localChanged && !cloudChanged) pick = l;
        else if (!localChanged && cloudChanged) pick = c;
        else pick = mergeIdea(l, c);
      }
    }
    if (pick) out.push(pick);
  }
  return out.sort((x, y) => stamp(y) - stamp(x));
}

function mergeIdea(l, c) {
  const out = { ...c, ...l }; // this device wins on plain fields
  for (const key of ['attachments', 'tags']) {
    if (Array.isArray(l[key]) || Array.isArray(c[key])) {
      out[key] = unionBy(l[key] || [], c[key] || [], (x) => (x && x.id) || canonical(x));
    }
  }
  if (Array.isArray(l.tasks) || Array.isArray(c.tasks)) {
    const m = new Map();
    for (const t of c.tasks || []) m.set(t.id || canonical(t), t);
    for (const t of l.tasks || []) {
      const k = t.id || canonical(t);
      const o = m.get(k);
      m.set(k, o ? { ...o, ...t, done: !!(o.done || t.done) } : t);
    }
    out.tasks = [...m.values()];
  }
  return out;
}

function unionBy(a, b, keyOf) {
  const m = new Map();
  for (const x of [...a, ...b]) {
    const k = keyOf(x);
    if (!m.has(k)) m.set(k, x);
  }
  return [...m.values()];
}

// ---------- the sync itself ----------
function busy() {
  return [...document.querySelectorAll('[id$="Overlay"]')].some((el) => {
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && el.getBoundingClientRect().width > 0;
  });
}

async function runSync() {
  const user = auth.currentUser;
  if (!user || !window.hiveLatest) return;
  const uid = user.uid;
  const ref = doc(db, 'users', uid);

  const cloudSnap = await getDoc(ref);
  const cloud = cloudSnap.exists() ? cloudSnap.data() : {};
  const C = cloud.json ? JSON.parse(cloud.json) : {};

  const localBlobs = {};
  const L = await pack(window.hiveLatest, localBlobs);
  const M = mergeStates(L, C, loadBase(uid));
  const mergedText = canonical(M);
  const newBase = baseFrom(M);

  // 1. Upload attachments first, so the cloud never points to a missing file.
  const uploaded = loadUploaded(uid);
  for (const h of Object.keys(localBlobs)) {
    if (uploaded.has(h)) continue;
    await uploadBlob(uid, h, localBlobs[h]);
    uploaded.add(h);
    saveUploaded(uid, uploaded);
  }

  // 2. Update the cloud copy if the merge differs from it.
  if (mergedText !== (cloud.json || '')) {
    await setDoc(ref, { json: mergedText, updatedAt: serverTimestamp(), ideaCount: (M.ideas || []).length }, { merge: true });
  }

  // 3. Bring this device up to date.
  if (canonical(L) === mergedText) {
    saveBase(uid, newBase);
    try { await syncReminders(M, uid); } catch (e) { console.warn('[hive] reminders', e); }
    setStatus('ok');
    return;
  }

  // Do not reload while the user is inside a pop-up. Try again shortly.
  if (busy()) {
    if (!deferredSince) deferredSince = Date.now();
    if (Date.now() - deferredSince < 10 * 60 * 1000) {
      setTimeout(syncNow, 30000);
      setStatus('ok');
      return;
    }
  }
  deferredSince = 0;

  const restored = await unpack(M, { uid, local: localBlobs });

  // If the page changed while we worked, run again instead of overwriting it.
  const check = await pack(window.hiveLatest, {});
  if (canonical(check) !== canonical(L)) { syncAgain = true; return; }

  saveBase(uid, newBase);
  setStatus('ok');
  window.hiveReplaceState(restored); // saves and reloads the page with the merged data
}

async function syncNow() {
  if (!auth.currentUser) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  setStatus('busy');
  try {
    do {
      syncAgain = false;
      await runSync();
    } while (syncAgain);
    setStatus('ok');
  } catch (e) {
    console.warn('[hive sync]', e);
    setStatus('err');
  } finally {
    syncing = false;
  }
}

function setStatus(s) {
  syncStatus = s;
  if (s === 'ok') {
    lastSynced = new Date().toTimeString().slice(0, 5);
    localStorage.setItem('hive-synced-time', lastSynced);
  }
  renderSyncLine();
}

function renderSyncLine() {
  const el = $('#syncLine');
  if (!el) return;
  el.textContent = syncStatus === 'busy' ? 'Syncing…'
    : syncStatus === 'err' ? 'Sync paused. It will try again by itself.'
    : lastSynced ? `Synced at ${lastSynced}` : 'Not synced yet';
}

// ---------- reminders (read by the GitHub Action every 5 minutes) ----------
async function syncReminders(M, uid) {
  const token = localStorage.getItem('hive-fcm-token');
  if (!token || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  const want = {};
  for (const idea of M.ideas || []) {
    for (const t of idea.tasks || []) {
      if (t.done || !t.scheduled) continue;
      const when = new Date(t.scheduled).getTime();
      if (isNaN(when) || when < now - 60000) continue;
      want[`${uid}_${t.id}`] = {
        uid,
        token,
        when: Timestamp.fromMillis(when),
        tag: `${t.id}@${t.scheduled}`,
        title: `Hive: ${String(idea.title || 'Reminder').slice(0, 100)}`,
        body: String(t.text || '').slice(0, 200)
      };
    }
  }
  const entries = Object.entries(want).slice(0, 400);
  const sig = hash(JSON.stringify(entries.map(([k, v]) => [k, v.tag, v.token, v.title, v.body])));
  if (sig === localStorage.getItem(`hive-rem-${uid}`)) return;

  const existing = await getDocs(query(collection(db, 'reminders'), where('uid', '==', uid)));
  const batch = writeBatch(db);
  existing.forEach((d) => { if (!want[d.id]) batch.delete(d.ref); });
  for (const [id, data] of entries) batch.set(doc(db, 'reminders', id), data);
  await batch.commit();
  localStorage.setItem(`hive-rem-${uid}`, sig);
}

async function enable() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return say('This browser cannot show reminders.', 'warn', '⚠️');
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    return say('Reminders are off. Allow notifications for this site in the browser settings.', 'warn', '⚠️');
  }
  if (!(await isSupported())) return say('Reminders are not supported in this browser.', 'warn', '⚠️');
  try {
    const reg = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return say('Could not get a reminder token. Try again.', 'warn', '⚠️');
    localStorage.setItem('hive-fcm-token', token);
    if (auth.currentUser) localStorage.removeItem(`hive-rem-${auth.currentUser.uid}`);
    await syncNow();
    say('Reminders are on. You will get a notice when a step is due.', 'ok', '🔔');
  } catch (e) {
    say(explain(e), 'warn', '⚠️');
  }
}

// ---------- profile ----------
const profKey = (uid) => `hive-profile-${uid}`;
const profile = (uid) => readJSON(profKey(uid), {});

async function pullProfile(uid) {
  const p = profile(uid);
  if (p.username || p.avatar) return;
  const s = await getDoc(doc(db, 'users', uid));
  if (!s.exists()) return;
  const d = s.data();
  if (d.username || d.avatar) {
    localStorage.setItem(profKey(uid), JSON.stringify({ username: d.username || '', avatar: d.avatar || '' }));
  }
}

async function saveProfile(patch) {
  const uid = auth.currentUser.uid;
  localStorage.setItem(profKey(uid), JSON.stringify({ ...profile(uid), ...patch }));
  await setDoc(doc(db, 'users', uid), patch, { merge: true });
}

async function saveName() {
  const v = ($('#accName')?.value || '').trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(v)) throw new Error('Use 3 to 20 letters, numbers or underscores.');
  await saveProfile({ username: v });
  refreshAccount();
  say(`Username saved: ${v}`, 'ok', '✨');
}

function fileToAvatar(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = 128;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const m = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => rej(new Error('That file is not a picture.'));
    img.src = url;
  });
}

// ---------- accounts ----------
const ERR = {
  'auth/invalid-email': 'That email does not look right.',
  'auth/weak-password': 'Use at least 6 characters for the password.',
  'auth/email-already-in-use': 'That email already has an account. Use Sign in instead.',
  'auth/invalid-credential': 'Email or password is wrong.',
  'auth/wrong-password': 'Email or password is wrong.',
  'auth/user-not-found': 'No account with that email yet.',
  'auth/popup-blocked': 'The browser blocked the Google window. Allow pop-ups for this site and try again.',
  'auth/popup-closed-by-user': 'The Google window was closed before it finished.',
  'auth/operation-not-allowed': 'This sign-in type is not switched on in Firebase yet.',
  'auth/unauthorized-domain': 'This website is not allowed in Firebase yet (Authentication, Settings, Authorized domains).',
  'auth/network-request-failed': 'No connection. Try again when you are online.'
};
const explain = (e) => ERR[e.code] || e.message || 'Something went wrong. Try again.';

function showMsg(text) {
  const m = $('#accMsg');
  if (m) m.textContent = text;
  else say(text, 'warn', '⚠️');
}

function creds() {
  const email = ($('#accEmail')?.value || '').trim();
  const pass = $('#accPass')?.value || '';
  if (!email || !pass) throw new Error('Enter your email and password.');
  return { email, pass };
}

async function emailSignIn() {
  const { email, pass } = creds();
  await signInWithEmailAndPassword(auth, email, pass);
  refreshAccount();
  say('Signed in. Your ideas will sync by themselves.', 'ok', '🐝');
}

async function createAccount() {
  const { email, pass } = creds();
  const u = auth.currentUser;
  if (u && u.isAnonymous) await linkWithCredential(u, EmailAuthProvider.credential(email, pass));
  else await createUserWithEmailAndPassword(auth, email, pass);
  refreshAccount();
  say('Account created. Your ideas are now safe to use on any device.', 'ok', '🎉');
}

async function googleSignIn() {
  const provider = new GoogleAuthProvider();
  const u = auth.currentUser;
  try {
    if (u && u.isAnonymous) await linkWithPopup(u, provider);
    else await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code !== 'auth/credential-already-in-use') throw e;
    await signInWithCredential(auth, GoogleAuthProvider.credentialFromError(e));
  }
  refreshAccount();
  say('Signed in with Google.', 'ok', '🔐');
}

async function signOutNow() {
  await signOut(auth);
  localStorage.removeItem('hive-synced-time');
  lastSynced = '';
  closeAccount();
  say('Signed out. This device keeps working on its own.', 'info', '👋');
}

const formHTML = () => `
  <input id="accEmail" type="email" placeholder="Email" autocomplete="email">
  <input id="accPass" type="password" placeholder="Password (6+ characters)" autocomplete="current-password">
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn" data-acc="signin">Sign in</button>
    <button class="btn ghost" data-acc="create">Create account</button>
  </div>
  <button class="btn ghost" data-acc="google" style="margin-top:8px;width:100%">🔐 Continue with Google</button>
  <p class="hk-small" id="accMsg"></p>`;

function renderAccount() {
  const body = $('#accountBody');
  if (!body) return;
  const u = auth.currentUser;
  if (!u) {
    body.innerHTML = `<h3>👤 Sign in to sync</h3>
      <p class="hk-small">Sign in once and your ideas, plans and sketches stay the same on every device. Sync runs by itself.</p>
      ${formHTML()}`;
    return;
  }
  const p = profile(u.uid);
  const initial = esc((p.username || u.email || 'H').charAt(0).toUpperCase());
  body.innerHTML = `
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:10px">
      <button class="hk-big" data-acc="photo" title="Change photo">${p.avatar ? `<img alt="" src="${p.avatar}">` : initial}</button>
      <div style="min-width:0">
        <h3 style="margin:0">${esc(p.username || 'Your profile')}</h3>
        <div class="hk-small">${u.isAnonymous ? 'Saved on this device. Create an account to use it on other devices.' : esc(u.email || 'Signed in with Google')}</div>
      </div>
    </div>
    <label class="hk-small">Username</label>
    <div style="display:flex;gap:8px;align-items:center">
      <input id="accName" value="${esc(p.username || '')}" placeholder="letters, numbers, _" maxlength="20" style="flex:1">
      <button class="btn" data-acc="saveName">Save</button>
    </div>
    <input id="accFile" type="file" accept="image/*" hidden>
    <p class="hk-small" id="syncLine"></p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn ghost" data-acc="sync">Sync now</button>
      ${u.isAnonymous ? '' : '<button class="btn ghost" data-acc="signout">Sign out</button>'}
    </div>
    <p class="hk-small" id="accMsg"></p>
    ${u.isAnonymous ? '<hr style="border:0;border-top:1px solid var(--line,#22304a);margin:12px 0">' + formHTML() : ''}`;
  renderSyncLine();
}

function paintAvatar() {
  const btn = $('#accountBtn');
  if (!btn) return;
  const u = auth.currentUser;
  const p = u ? profile(u.uid) : {};
  if (!u || (u.isAnonymous && !p.username && !p.avatar)) {
    btn.textContent = '👤';
    btn.title = 'Account';
    return;
  }
  btn.innerHTML = p.avatar ? `<img alt="" src="${p.avatar}">` : esc((p.username || u.email || 'H').charAt(0).toUpperCase());
  btn.title = p.username || 'Account';
}

function refreshAccount() {
  const u = auth.currentUser;
  document.body.dataset.account = u && !u.isAnonymous ? 'in' : 'out';
  paintAvatar();
  if ($('#accountOverlay')?.classList.contains('show')) renderAccount();
}

function openAccount() {
  renderAccount();
  $('#accountOverlay').classList.add('show');
}

function closeAccount() {
  $('#accountOverlay')?.classList.remove('show');
}

async function handleAuth(user) {
  if (!user) {
    document.body.dataset.account = 'out';
    paintAvatar();
    try { await signInAnonymously(auth); } catch (e) { console.warn('[hive] anonymous sign-in failed', e); }
    return;
  }
  refreshAccount();
  await pullProfile(user.uid).catch(() => {});
  refreshAccount();
  syncNow();
}

function mountHeader() {
  const header = document.querySelector('header');
  if (!header) return;
  const slot = document.createElement('div');
  slot.id = 'accountSlot';
  slot.style.cssText = 'margin-left:auto;display:flex;align-items:center';
  const btn = document.createElement('button');
  btn.className = 'hk-av';
  btn.id = 'accountBtn';
  btn.setAttribute('aria-label', 'Account');
  btn.addEventListener('click', openAccount);
  slot.appendChild(btn);
  header.appendChild(slot);
}

function wireEvents() {
  const ov = $('#accountOverlay');
  ov.addEventListener('click', (e) => { if (e.target === ov) closeAccount(); });

  const body = $('#accountBody');
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    const act = b.dataset.acc;
    try {
      if (act === 'photo') { $('#accFile')?.click(); return; }
      if (act === 'signin') await emailSignIn();
      else if (act === 'create') await createAccount();
      else if (act === 'google') await googleSignIn();
      else if (act === 'saveName') await saveName();
      else if (act === 'sync') await syncNow();
      else if (act === 'signout') await signOutNow();
    } catch (err) {
      showMsg(explain(err));
    }
  });

  body.addEventListener('change', async (e) => {
    if (e.target.id !== 'accFile' || !e.target.files[0]) return;
    try {
      const avatar = await fileToAvatar(e.target.files[0]);
      await saveProfile({ avatar });
      refreshAccount();
      say('Profile photo updated.', 'ok', '📸');
    } catch (err) {
      showMsg(explain(err));
    }
    e.target.value = '';
  });
}

function init() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  mountHeader();

  const ov = document.createElement('div');
  ov.className = 'hk-ov';
  ov.id = 'accountOverlay';
  ov.innerHTML = '<div class="hk-modal" id="accountBody"></div>';
  document.body.appendChild(ov);

  wireEvents();
  paintAvatar();
  renderSyncLine();

  // Automatic, silent sync. No messages.
  window.addEventListener('hive:saved', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(syncNow, 2000);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });
  window.addEventListener('online', () => syncNow());
  setInterval(() => syncNow(), 60000);

  onAuthStateChanged(auth, handleAuth);
}

init();

window.hivePush = { enable, openAccount, syncNow };