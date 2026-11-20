// push.js: accounts (anonymous, email, Google), reminders, and cloud sync (Firebase Spark plan)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInAnonymously, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  linkWithCredential, linkWithPopup, signInWithPopup, signInWithCredential,
  EmailAuthProvider, GoogleAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, setDoc, getDoc, deleteDoc, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getMessaging, getToken, isSupported } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDAf5AXYGqDrnZ1eeaBTU4yz2wkgzLNZXI",
  authDomain: "hive-arc.firebaseapp.com",
  projectId: "hive-arc",
  storageBucket: "hive-arc.firebasestorage.app",
  messagingSenderId: "332100908160",
  appId: "1:332100908160:web:319f2097a5e095fd50e265",
  measurementId: "G-4D13YMBZ26"
};
const VAPID_KEY = 'BEEM2pD3Cw3tD_co_ytjt8ylw_ax5i39WXN7Napza0PYQd-QxZABETd9LZOCHC7kzHOjWZbqJ7RhmkdqkqhKLfE';

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const canNotify = 'Notification' in window;

const SIG_KEY = 'hive-push-sigs';
const SYNCED_KEY = 'hive-synced-uid';
const TIME_KEY = 'hive-synced-time';

let token = null, messaging = null, reminderTimer = null, cloudTimer = null;
let cloudReady = false, syncingUid = null;
let sigs = new Map();
try { sigs = new Map(JSON.parse(localStorage.getItem(SIG_KEY) || '[]')); } catch {}
const saveSigs = () => localStorage.setItem(SIG_KEY, JSON.stringify([...sigs]));

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const currentUser = () => auth.currentUser;
const isAccount = u => !!u && !u.isAnonymous;

/* ---------- account UI ---------- */
const slot = document.createElement('div');
slot.className = 'row';
document.querySelector('header')?.appendChild(slot);

const overlay = document.createElement('div');
overlay.className = 'overlay';
overlay.id = 'accountOverlay';
overlay.innerHTML = '<div class="modal" id="accountBody"></div>';
document.body.appendChild(overlay);
const body = $('#accountBody');
overlay.addEventListener('click', e => { if (e.target === overlay) closeAccount(); });

function renderHeader() {
  const u = currentUser();
  slot.innerHTML = `<button class="btn ghost" id="accountBtn">${isAccount(u) ? '☁️ ' + esc(u.email || 'Account') : '👤 Sign in'}</button>`;
  $('#accountBtn').onclick = openAccount;
}
function openAccount() { renderAccount(); overlay.classList.add('open'); }
function closeAccount() { overlay.classList.remove('open'); }
function renderAccountIfOpen() { if (overlay.classList.contains('open')) renderAccount(); }
const setMsg = t => { const m = $('#accMsg', body); if (m) m.textContent = t; };

function renderAccount(message = '') {
  const u = currentUser();
  const synced = Number(localStorage.getItem(TIME_KEY) || 0);
  const syncedText = synced ? 'Last synced ' + new Date(synced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ideas sync after each change.';
  if (isAccount(u)) {
    body.innerHTML = `
      <div class="row" style="justify-content:space-between">
        <h3 style="margin:0">☁️ Your account</h3>
        <button class="btn ghost" data-acc="close">Close</button>
      </div>
      <p style="margin:12px 0 4px">${esc(u.email || 'Signed in')}</p>
      <p class="muted">${syncedText}</p>
      <p class="muted">Text, plans and reminders sync. Photos and voice notes stay on this device.</p>
      <div class="row" style="margin-top:14px">
        <button class="btn" data-acc="sync">⟳ Sync now</button>
        <button class="btn ghost" data-acc="signout">Sign out</button>
      </div>
      <p class="muted" id="accMsg" style="margin-top:12px">${esc(message)}</p>`;
  } else {
    body.innerHTML = `
      <div class="row" style="justify-content:space-between">
        <h3 style="margin:0">👤 Sign in to sync</h3>
        <button class="btn ghost" data-acc="close">Close</button>
      </div>
      <p class="muted">Your ideas and reminders follow your account to any device. Anything you've already added stays with you.</p>
      <input id="accEmail" type="email" placeholder="Email" autocomplete="email" />
      <input id="accPass" type="password" placeholder="Password (6+ characters)" autocomplete="current-password" style="margin-top:8px" />
      <div class="row" style="margin-top:12px">
        <button class="btn" data-acc="signin">Sign in</button>
        <button class="btn ghost" data-acc="create">Create account</button>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn ghost" data-acc="google">🔐 Continue with Google</button>
      </div>
      <p class="muted" id="accMsg" style="margin-top:12px">${esc(message)}</p>`;
  }
}

function explain(err) {
  const map = {
    'auth/invalid-email': 'That email address looks wrong.',
    'auth/weak-password': 'Use a password of at least 6 characters.',
    'auth/email-already-in-use': 'That email already has an account. Use Sign in instead.',
    'auth/invalid-credential': 'Email or password is wrong.',
    'auth/wrong-password': 'Email or password is wrong.',
    'auth/user-not-found': 'Email or password is wrong.',
    'auth/popup-blocked': 'The Google window was blocked. Allow pop-ups for this site and try again.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/operation-not-allowed': 'This sign-in method is not turned on in Firebase yet.',
    'auth/unauthorized-domain': 'This domain is not authorized. Add it in Firebase → Authentication → Settings.',
    'auth/network-request-failed': 'No connection. Try again when you are online.'
  };
  return map[err.code] || ('Sign-in failed: ' + (err.code || err.message));
}

body.addEventListener('click', async e => {
  const b = e.target.closest('[data-acc]');
  if (!b) return;
  const action = b.dataset.acc;
  if (action === 'close') return closeAccount();

  if (action === 'signout') {
    await signOut(auth);
    localStorage.removeItem(SYNCED_KEY);
    localStorage.removeItem(TIME_KEY);
    await signInAnonymously(auth);
    cloudReady = false;
    return renderAccount('Signed out. This device keeps working on its own.');
  }

  if (action === 'sync') {
    try { await cloudSave(); renderAccount('Synced.'); }
    catch (err) { renderAccount('Sync failed: ' + (err.message || err.code)); }
    return;
  }

  const email = $('#accEmail', body)?.value.trim() || '';
  const pass = $('#accPass', body)?.value || '';
  if ((action === 'signin' || action === 'create') && (!email || !pass)) {
    return setMsg('Enter your email and password.');
  }

  try {
    setMsg('Working…');
    const u = currentUser();
    const anon = !!u && u.isAnonymous;
    if (action === 'signin') {
      await signInWithEmailAndPassword(auth, email, pass);
    } else if (action === 'create') {
      if (anon) await linkWithCredential(u, EmailAuthProvider.credential(email, pass));
      else await createUserWithEmailAndPassword(auth, email, pass);
    } else if (action === 'google') {
      if (anon) {
        try { await linkWithPopup(u, googleProvider); }
        catch (err) {
          // This Google account already exists. Sign in to it instead.
          if (err.code !== 'auth/credential-already-in-use') throw err;
          await signInWithCredential(auth, GoogleAuthProvider.credentialFromError(err));
        }
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    }
    await ensureSynced();
    renderHeader();
    closeAccount();
  } catch (err) {
    console.warn('Account action failed', err);
    setMsg(explain(err));
  }
});

/* ---------- auth state ---------- */
onAuthStateChanged(auth, () => {
  renderHeader();
  ensureSynced();
  scheduleReminders();
});
signInAnonymously(auth).catch(err => console.warn('Anonymous sign-in failed', err));

/* ---------- cloud sync (one document per account) ---------- */
function waitForLocal() {
  return new Promise(resolve => {
    let tries = 0;
    const t = setInterval(() => {
      if (window.hiveLatest || ++tries > 100) { clearInterval(t); resolve(window.hiveLatest || null); }
    }, 100);
  });
}

function cleanForCloud(s) {
  // Attachments are stored as blobs on the device, so only their details are synced.
  return JSON.parse(JSON.stringify({
    ...s,
    ideas: (s.ideas || []).map(i => ({ ...i, attachments: (i.attachments || []).map(({ blob, ...rest }) => rest) }))
  }));
}

function readCloud(data) {
  try { return JSON.parse(data.json); } catch { return null; }
}

async function cloudSave() {
  const u = currentUser();
  const latest = window.hiveLatest;
  if (!isAccount(u) || !latest) return;
  const clean = cleanForCloud(latest);
  const json = JSON.stringify(clean);
  if (json.length > 900000) { console.warn('Ideas are too large to sync in one document'); return; }
  const stamp = Date.now();
  await setDoc(doc(db, 'users', u.uid), {
    json,
    updatedAt: Timestamp.fromMillis(stamp),
    ideaCount: clean.ideas.length
  });
  localStorage.setItem(TIME_KEY, String(stamp));
  localStorage.setItem(SYNCED_KEY, u.uid);
  renderAccountIfOpen();
}

async function syncWithCloud(accountUid) {
  const local = await waitForLocal();
  const localIdeas = local?.ideas?.length || 0;
  const snap = await getDoc(doc(db, 'users', accountUid));
  const remote = snap.exists() ? readCloud(snap.data()) : null;
  const remoteTime = snap.exists() ? (snap.data().updatedAt?.toMillis?.() || 0) : 0;
  const seenTime = Number(localStorage.getItem(TIME_KEY) || 0);

  // Another device saved after this device last synced.
  if (remote && remoteTime > seenTime + 1000) {
    const remoteIdeas = remote.ideas?.length || 0;
    const useCloud = localIdeas === 0 || confirm(
      `Your account has ${remoteIdeas} idea(s) saved from another device.\n\n` +
      `OK: load them here and replace the ${localIdeas} idea(s) on this device.\n` +
      `Cancel: keep this device's ideas and replace the account copy with them.`
    );
    if (useCloud) {
      localStorage.setItem(SYNCED_KEY, accountUid);
      localStorage.setItem(TIME_KEY, String(remoteTime));
      if (window.hiveReplaceState) return window.hiveReplaceState(remote);
      return;
    }
  }
  await cloudSave();
}

async function ensureSynced() {
  const u = currentUser();
  if (!isAccount(u)) { cloudReady = false; return; }
  if (syncingUid === u.uid) return;
  syncingUid = u.uid;
  try { await syncWithCloud(u.uid); cloudReady = true; }
  catch (err) { console.warn('Account sync failed', err); cloudReady = false; }
  finally { syncingUid = null; }
}

function scheduleCloud() {
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(async () => {
    if (!cloudReady) await ensureSynced();
    if (cloudReady) await cloudSave().catch(err => console.warn('Cloud save failed', err));
  }, 2000);
}

/* ---------- reminders ---------- */
async function getMessagingSafe() {
  if (messaging) return messaging;
  if (!(await isSupported())) return null;
  messaging = getMessaging(app);
  return messaging;
}

async function fetchToken() {
  const m = await getMessagingSafe();
  if (!m || !canNotify || Notification.permission !== 'granted') return null;
  const reg = await navigator.serviceWorker.ready;
  token = await getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  return token;
}

async function enable() {
  if (!canNotify || !('serviceWorker' in navigator)) return 'Notifications are not supported in this browser.';
  if (!(await getMessagingSafe())) return 'Push is not supported here. On iPhone, add Hive to your Home Screen first (iOS 16.4 or later).';
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') return 'Reminders are off. Allow notifications for this site in browser settings.';
  try { await fetchToken(); }
  catch (err) { console.error(err); return 'Could not register this device. Check the browser console.'; }
  if (!token) return 'Could not get a device token. Try again.';
  await syncReminders();
  return 'Reminders on. You will get alerts even when Hive is closed.';
}

function scheduleReminders() {
  clearTimeout(reminderTimer);
  reminderTimer = setTimeout(syncReminders, 1500);
}

async function syncReminders() {
  const u = currentUser();
  const latest = window.hiveLatest;
  if (!u || !token || !latest) return;
  const now = Date.now();
  const want = new Map();
  for (const idea of latest.ideas || []) for (const t of idea.tasks || []) {
    if (!t.scheduled || t.done) continue;
    const when = new Date(t.scheduled).getTime();
    if (isNaN(when) || when <= now) continue;
    want.set(`${u.uid}_${t.id}`, {
      when,
      tag: `${t.id}@${t.scheduled}`,
      title: `Hive: ${idea.title}`.slice(0, 120),
      body: String(t.text).slice(0, 200)
    });
  }
  try {
    for (const [id, r] of want) {
      const sig = [token, r.when, r.tag, r.title, r.body].join('|');
      if (sigs.get(id) === sig) continue;
      await setDoc(doc(db, 'reminders', id), {
        uid: u.uid, token,
        when: Timestamp.fromMillis(r.when),
        tag: r.tag, title: r.title, body: r.body
      });
      sigs.set(id, sig);
    }
    for (const id of [...sigs.keys()]) {
      if (!want.has(id)) {
        await deleteDoc(doc(db, 'reminders', id)).catch(() => {});
        sigs.delete(id);
      }
    }
    saveSigs();
  } catch (err) {
    console.error('Reminder sync failed', err);
  }
}

/* ---------- hooks from index.html ---------- */
window.addEventListener('hive:saved', () => { scheduleReminders(); scheduleCloud(); });
if (canNotify && Notification.permission === 'granted') fetchToken().catch(() => {});
scheduleReminders();

window.hivePush = { enable, openAccount };