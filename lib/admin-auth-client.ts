// Browser side of the admin sign-in (Firebase Authentication, email + password).
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function auth() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

export type AdminUser = { email: string };

export function watchAdminUser(callback: (user: AdminUser | null) => void) {
  return onAuthStateChanged(auth(), (user: User | null) =>
    callback(user?.email ? { email: user.email } : null),
  );
}

export async function adminSignIn(email: string, password: string) {
  await signInWithEmailAndPassword(auth(), email.trim(), password);
}

export async function adminSignOut() {
  await signOut(auth());
}

export async function adminResetPassword(email: string) {
  await sendPasswordResetEmail(auth(), email.trim());
}

/** A short-lived proof of sign-in that every admin server action checks. */
export async function adminToken(): Promise<string> {
  const user = auth().currentUser;
  if (!user) throw new Error('You are signed out. Sign in again.');
  return user.getIdToken();
}
