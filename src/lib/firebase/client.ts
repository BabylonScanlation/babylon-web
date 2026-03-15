// src/lib/firebase/client.ts
import { getApp, getApps, initializeApp } from 'firebase/app';
import { logError } from '../logError';

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || 
              (import.meta.env.PUBLIC_FIREBASE_PROJECT_ID ? `${import.meta.env.PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com` : ''),
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

// Inicializar app si no existe (Ligero)
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Orion: Función para obtener Auth de forma perezosa
export const getClientAuth = async () => {
  const { getAuth, setPersistence, browserLocalPersistence } = await import('firebase/auth');
  const auth = getAuth(app);
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    logError(error, 'Error configurando persistencia de Firebase');
  }
  return auth;
};
