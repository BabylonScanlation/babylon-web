// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { getDB } from './lib/db';
import { verifyFirebaseToken } from './lib/firebase/server';

export const onRequest = defineMiddleware(async (context, next) => {
  const runtime = context.locals.runtime;
  const db = runtime?.env?.DB ? getDB(runtime.env) : undefined;
  context.locals.db = db;
  context.locals.user = undefined;

  const sessionCookie = context.cookies.get('user_session')?.value;

  if (sessionCookie && db) {
    try {
      const payload = await verifyFirebaseToken(sessionCookie, runtime.env) as {
        sub: string;
        email?: string;
        email_verified?: boolean;
      };

      if (payload && payload.sub) {
        let isAdmin = false;
        const uid = String(payload.sub);
        
        const superAdminUid = runtime.env.SUPER_ADMIN_UID;
        if (superAdminUid && uid === superAdminUid) {
          isAdmin = true;
        } else {
          const userRole = await db
            .prepare('SELECT role FROM UserRoles WHERE user_id = ?')
            .bind(uid)
            .first<{ role: string }>();
          
          if (userRole && userRole.role === 'admin') {
            isAdmin = true;
          }
        }
        
        context.locals.user = {
          uid,
          email: payload.email || null,
          emailVerified: payload.email_verified || false,
          isAdmin,
        };
      }
    } catch (error) {
      console.error('Error verificando token de sesión:', error);
      context.cookies.delete('user_session', { path: '/' });
    }
  }

  const currentPath = context.url.pathname;
  
  if (currentPath.startsWith('/admin') && !context.locals.user?.isAdmin) {
    return context.redirect('/');
  }

  return next();
});
