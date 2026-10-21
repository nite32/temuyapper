import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

let services;

export function firebaseServices() {
  if (services) return services;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
  if (!serviceAccountJson || !databaseURL) {
    throw new Error('Backend Firebase belum dikonfigurasi. Isi FIREBASE_SERVICE_ACCOUNT dan FIREBASE_DATABASE_URL di Vercel.');
  }

  const app = getApps()[0] || initializeApp({
    credential: cert(JSON.parse(serviceAccountJson)),
    databaseURL,
  });

  services = { auth: getAuth(app), database: getDatabase(app) };
  return services;
}
