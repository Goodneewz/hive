// scripts/send-reminders.mjs: sends due reminders, then deletes them
import admin from 'firebase-admin';

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT secret is missing');
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});

const db = admin.firestore();
const messaging = admin.messaging();

// Errors where retrying will never work. The reminder is dropped.
const PERMANENT = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
]);

const snap = await db.collection('reminders')
  .where('when', '<=', admin.firestore.Timestamp.now())
  .limit(200)
  .get();

console.log(`Due reminders: ${snap.size}`);

for (const d of snap.docs) {
  const r = d.data();
  try {
    await messaging.send({
      token: r.token,
      data: { title: r.title || 'Hive', body: r.body || '', tag: r.tag || d.id },
      webpush: { headers: { Urgency: 'high' } }
    });
    await d.ref.delete();
    console.log('Sent', d.id);
  } catch (err) {
    console.warn('Failed', d.id, err.code);
    if (PERMANENT.has(err.code)) await d.ref.delete();
  }
}