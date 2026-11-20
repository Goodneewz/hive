// push.js: device registration and reminder sync (Spark plan, no Cloud Functions)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, setDoc, deleteDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
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
const canNotify = 'Notification' in window;

let uid = null, token = null, messaging = null, timer = null;
const SIG_KEY = 'hive-push-sigs';
let sigs = new Map();
try { sigs = new Map(JSON.parse(localStorage.getItem(SIG_KEY) || '[]')); } catch {}
const saveSigs = () => localStorage.setItem(SIG_KEY, JSON.stringify([...sigs]));

onAuthStateChanged(auth, user => { uid = user ? user.uid : null; schedule(); });
signInAnonymously(auth).catch(err => console.warn('Anonymous sign-in failed', err));

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
  await syncNow();
  return 'Reminders on. You will get alerts even when Hive is closed.';
}

function schedule() { clearTimeout(timer); timer = setTimeout(syncNow, 1500); }

// One reminder document per future scheduled step. Removes documents for steps that no longer need one.
async function syncNow() {
  const latest = window.hiveLatest;
  if (!uid || !token || !latest) return;
  const now = Date.now();
  const want = new Map();
  for (const idea of latest.ideas || []) for (const t of idea.tasks || []) {
    if (!t.scheduled || t.done) continue;
    const when = new Date(t.scheduled).getTime();
    if (isNaN(when) || when <= now) continue;
    want.set(`${uid}_${t.id}`, {
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
        uid, token,
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

window.addEventListener('hive:saved', schedule);
if (canNotify && Notification.permission === 'granted') fetchToken().catch(() => {});
schedule();

window.hivePush = { enable };