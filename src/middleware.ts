import { defineMiddleware } from 'astro:middleware';
import { getDB } from './lib/db';

export const onRequest = defineMiddleware(async (context, next) => {
  const runtime = context.locals.runtime;

  if (runtime?.env?.DB) {
    context.locals.db = getDB(runtime.env);
  }

  context.locals.user = undefined;
  const sessionCookie = context.cookies.get('user_session')?.value;

  if (sessionCookie) {
    try {
      const decodedCookie = Buffer.from(sessionCookie, 'base64').toString(
        'utf-8'
      );
      const userData = JSON.parse(decodedCookie);

      // Verificar sesión activa en Firebase
      const auth = getAuth();
      if (auth.currentUser?.uid === userData.uid) {
        context.locals.user = userData;
      }
    } catch (error) {
      console.error('Error decoding session cookie:', error);
      context.cookies.delete('user_session');
    }
  }

  return next();
});
// Replace this stub with the actual import from your authentication library, e.g. Firebase Auth
// import { getAuth } from 'firebase/auth';
// Or implement a mock for development:
function getAuth() {
  return {
    currentUser: {
      uid: 'mock-uid', // Replace with actual logic to get the current user
    },
  };
}
