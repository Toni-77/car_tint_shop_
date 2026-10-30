import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  // Checks for direct backend environment strings if the public bundle is inaccessible to the Server Action
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID
};

// Check initialization data validity before gRPC pipeline instantiation
if (!firebaseConfig.projectId) {
  console.error("Critical Error: Firebase config is missing values inside the active Server Action runtime environment.");
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = (app as any)._firestoreInstance 
  ? getFirestore(app)
  : initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });