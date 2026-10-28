import * as admin from 'firebase-admin';

function initFirebaseAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }

  console.log('Firebase Admin using project:', serviceAccount.project_id);

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const app = admin.apps.length ? admin.app() : initFirebaseAdmin();

export const dbAdmin = admin.firestore(app);