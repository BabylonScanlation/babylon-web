// src/pages/api/auth/logout.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('user_session', { path: '/' });

  // Limpiar sesión de Firebase
  const auth = getAuth();
  await auth.signOut();

  return redirect('/');
};
import { getAuth as getFirebaseAuth } from 'firebase/auth';
// Make sure you have a firebase.ts file exporting your initialized app in src/lib/firebase.ts
import * as firebase from '../../../lib/firebase/client'; // Adjust the path if your firebase.ts is at src/lib/firebase.ts

function getAuth() {
  return getFirebaseAuth(firebase.app);
}
