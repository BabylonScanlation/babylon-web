import { defineMiddleware } from 'astro:middleware';
import { getDB } from './lib/db';
import { verifyFirebaseToken } from './lib/firebase/server';

export const onRequest = defineMiddleware(async (context, next) => {
  const runtime = context.locals.runtime;

  if (runtime?.env?.DB) {
    context.locals.db = getDB(runtime.env);
  }

  context.locals.user = undefined;
  const sessionCookie = context.cookies.get('user_session')?.value;
  const adminSessionCookie = context.cookies.get('session')?.value;

  if (adminSessionCookie === 'admin-logged-in') {
    context.locals.user = {
      uid: 'admin', // A placeholder UID for admin
      email: 'admin@example.com', // A placeholder email for admin
      isAdmin: true,
    };
  } else if (sessionCookie) {
    try {
      const payload = (await verifyFirebaseToken(
        sessionCookie,
        runtime.env
      )) as {
        sub: string;
        email?: string;
        email_verified?: boolean;
      };

      if (payload && payload.sub) {
        context.locals.user = {
          uid: String(payload.sub),
          email: payload.email || null,
          emailVerified: payload.email_verified || false,
        };
      }
    } catch (error) {
      console.error('Error verificando token de sesión:', error);
      context.cookies.delete('user_session', { path: '/' });
    }
  }

  return next();
});
