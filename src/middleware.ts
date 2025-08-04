import { defineMiddleware } from 'astro:middleware';
import { getDB } from './lib/db';
import { verifySessionCookie } from './lib/firebase/server';

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
      context.locals.user = {
        uid: userData.uid ?? '',
        email: userData.email as string,
        emailVerified: userData.emailVerified ?? false,
      } as { uid: string; email: string; emailVerified: boolean };
    } catch (error) {
      console.error('Error verificando la cookie de sesión:', error);
      context.cookies.delete('user_session', { path: '/' });
    }
  }

  return next();
});
