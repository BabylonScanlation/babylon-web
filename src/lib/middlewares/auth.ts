// src/lib/middlewares/auth.ts
import type { APIContext, MiddlewareNext } from 'astro';
import { and, eq, gt } from 'drizzle-orm';
import { sessions, userRoles, users } from '../../db/schema';
import { getDB } from '../db-client';
import { logError } from '../logError';
import { deleteSession, setAuthCookie, verifyToken } from '../session';

export function clearSessionCache(_sessionId?: string) {
  // Legacy stub: session cache removed to prevent memory leaks in isolates
}

export async function authFlow(context: APIContext, next: MiddlewareNext) {
  const { cookies, locals, request: _request, url } = context;
  const currentPath = url.pathname;
  const runtime = locals.runtime;

  // Orion: Si no hay base de datos, saltamos la auth de D1
  const db = runtime?.env?.DB ? getDB(runtime.env) : undefined;
  locals.db = db;
  locals.user = undefined;

  const authCookie = cookies.get('user_auth')?.value;
  const sessionId = cookies.get('user_session')?.value;

  // 1. FAST-PATH: Verificación JWT (Zero D1 Reads - 15 min expiración)
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

  // 2. SLOW-PATH: Verificación de sesión en D1 (Si el JWT expiró, no existe, o necesitamos revalidar)
  const isCriticalPath =
    currentPath === '/verify' ||
    currentPath === '/terms' ||
    currentPath.startsWith('/js/') ||
    currentPath.startsWith('/_astro');

  if (!locals.user && sessionId && db && !locals.isBot) {
    try {
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
          and(eq(sessions.id, sessionId), gt(sessions.expiresAt, Math.floor(Date.now() / 1000)))
        )
        .get();

      if (result?.session) {
        const uid = result.session.userId;
        const role =
          runtime.env.SUPER_ADMIN_UID && uid === runtime.env.SUPER_ADMIN_UID
            ? 'admin'
            : result.role || 'user';
        const userObj = {
          uid,
          email: result.user.email,
          username: result.user.username || undefined,
          displayName: result.user.displayName || undefined,
          avatarUrl: result.user.avatarUrl || undefined,
          isAdmin: role === 'admin',
          isNsfw: result.user.isNsfw ?? false,
          preferences: result.user.preferences || '{}',
        };
        locals.user = userObj;

        // Auto-refresh: Emitimos un nuevo JWT válido por 15 mins ya que la sesión D1 es válida
        if (runtime?.env?.JWT_SECRET) {
          await setAuthCookie(
            context,
            {
              uid: userObj.uid,
              email: userObj.email,
              username: userObj.username || null,
              displayName: userObj.displayName || null,
              role: role,
              isNsfw: userObj.isNsfw,
            },
            runtime.env.JWT_SECRET
          );
        }
      } else {
        // Sesión no válida en D1 (ej. expirada o usuario baneado/sesión borrada)
        deleteSession(context);
      }
    } catch (error) {
      logError(error, 'Auth Middleware Error');
      deleteSession(context);
    }
  }

  // Redirecciones de seguridad
  if (currentPath.startsWith('/admin') && !locals.user?.isAdmin) {
    return context.redirect('/');
  }

  return next();
}
