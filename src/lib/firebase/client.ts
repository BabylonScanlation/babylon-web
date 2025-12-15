// src/lib/firebase/client.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: 'babylon-scanlation-users.firebaseapp.com',
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: 'babylon-scanlation-users.firebasestorage.app',
  messagingSenderId: '1091956230989',
  appId: '1:1091956230989:web:6184d7f256976c1e570504',
};

// Inicializar app si no existe
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Obtener instancia de autenticación
export const auth = getAuth(app);

// Configurar persistencia de sesión
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('Persistencia de Firebase configurada');
  })
  .catch((error) => {
    console.error('Error configurando persistencia:', error);
  });
