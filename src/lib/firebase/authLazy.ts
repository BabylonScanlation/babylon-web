import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { app } from './client';

// Inicializar auth y establecer persistencia de forma asíncrona
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);

export {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
};
