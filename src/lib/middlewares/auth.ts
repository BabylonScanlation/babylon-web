// src/lib/middlewares/auth.ts
import type { MiddlewareNext } from 'astro';
import { and, eq, gt } from 'drizzle-orm';
import { sessions, userRoles, users } from '../../db/schema';
import { getDB } from '../db-client';
import { logError } from '../logError';
import { deleteSession, verifyToken } from '../session';

// Orion: Cache de sesiones en memoria del Worker (TTL: 1 min)
const sessionCache = new Map<string, { user: any; expires: number }>();
const SESSION_CACHE_TTL = 60000;

export async function authFlow(context: any, next: MiddlewareNext) {
  const { cookies, locals, request, url } = context;
  const currentPath = url.pathname;
  const runtime = locals.runtime;

  // Orion: Si no hay base de datos, saltamos la auth de D1
  const db = runtime?.env?.DB ? getDB(runtime.env) : undefined;
  locals.db = db;
  locals.user = undefined;

  const authCookie = cookies.get('user_auth')?.value;
  const sessionId = cookies.get('user_session')?.value;

  // 1. FAST-PATH: Verificación JWT (Zero D1 Reads)
  if (authCookie && runtime?.env?.JWT_SECRET) {
    const payload = await verifyToken(authCookie, runtime.env.JWT_SECRET);
    if (payload) {
      locals.user = {
        uid: payload.uid,
        email: payload.email,
        username: payload.username || undefined,
        displayName: payload.displayName || undefined,
        isAdmin: payload.role === 'admin' || payload.uid === runtime.env.SUPER_ADMIN_UID,
        isNsfw: payload.isNsfw,
      };
    }
  }

  // 2. SLOW-PATH: Verificación de sesión en D1 (Si el JWT no existe o no es admin y necesitamos check extra)
  // Orion: Solo consultamos D1 si no es un asset y tenemos sessionId
  const isAssetPath =
    currentPath.startsWith('/api/r2-cache/') ||
    currentPath.startsWith('/api/assets/') ||
    currentPath.startsWith('/js/') ||
    currentPath.startsWith('/_astro');

  if (!locals.user && sessionId && db && !isAssetPath && !locals.isBot) {
    // 2.1 Verificar Cache en memoria
    const cached = sessionCache.get(sessionId);
    if (cached && cached.expires > Date.now()) {
      locals.user = cached.user;
    } else {
      try {
        const userAgent = request.headers.get('user-agent') || 'unknown';
        const result = await db
          .select({
            session: sessions,
            user: users,
            role: userRoles.role,
          })
          .from(sessions)
          .innerJoin(users, eq(sessions.userId, users.id))
          .leftJoin(userRoles, eq(sessions.userId, userRoles.userId))
          .where(
            and(
              eq(sessions.id, sessionId),
              gt(sessions.expiresAt, Math.floor(Date.now() / 1000)),
              eq(sessions.userAgent, userAgent)
            )
          )
          .get();

        if (result && result.session) {
          const uid = result.session.userId;
          const userObj = {
            uid,
            email: result.user.email,
            username: result.user.username || undefined,
            displayName: result.user.displayName || undefined,
            avatarUrl: result.user.avatarUrl || undefined,
            isAdmin:
              (runtime.env.SUPER_ADMIN_UID && uid === runtime.env.SUPER_ADMIN_UID) ||
              result.role === 'admin',
            isNsfw: result.user.isNsfw ?? false,
            preferences: result.user.preferences || '{}',
          };
          locals.user = userObj;
          
          // Guardar en cache para evitar la query en el próximo clic
          sessionCache.set(sessionId, { user: userObj, expires: Date.now() + SESSION_CACHE_TTL });
        } else {
          deleteSession(context);
          sessionCache.delete(sessionId);
        }
      } catch (error) {
        logError(error, 'Auth Middleware Error');
        deleteSession(context);
      }
    }
  }

  // Redirecciones de seguridad
  if (currentPath.startsWith('/admin') && !locals.user?.isAdmin) {
    return context.redirect('/');
  }

  return next();
}
