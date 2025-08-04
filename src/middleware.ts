import { defineMiddleware } from 'astro:middleware';
import { getDB } from './lib/db';
import { verifySessionCookie } from './lib/firebase/server'; // Nueva función

export const onRequest = defineMiddleware(async (context, next) => {
  const runtime = context.locals.runtime;

  if (runtime?.env?.DB) {
    context.locals.db = getDB(runtime.env);
  }

  context.locals.user = undefined;
  const sessionCookie = context.cookies.get('user_session')?.value;

  if (sessionCookie) {
    try {
      const userData = await verifySessionCookie(sessionCookie, runtime.env);
      if (typeof userData.uid === 'string') {
        context.locals.user = {
          uid: userData.uid,
          email: typeof userData.email === 'string' ? userData.email : null,
        };
      } else {
        context.locals.user = undefined;
      }
    } catch (error) {
      console.error('Error verifying session cookie:', error);
      context.cookies.delete('user_session', { path: '/' });
    }
  }

  return next();
});
