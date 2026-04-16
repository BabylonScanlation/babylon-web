// src/lib/middlewares/auth.ts
import type { APIContext, MiddlewareNext } from 'astro';
import { and, eq, gt } from 'drizzle-orm';
import { sessions, userRoles, users } from '../../db/schema';
import { getDB } from '../db-client';
import { logError } from '../logError';
import { deleteSession, setAuthCookie, verifyToken } from '../session';

export function clearSessionCache(context: { cookies: any }) {
  // Borramos el cookie de auth para forzar al middleware a entrar en el SLOW-PATH (Lectura de DB)
  // Esto asegura que cualquier cambio de estado (como NSFW o Roles) se refleje inmediatamente.
  context.cookies.delete('user_auth', { path: '/' });
}

export async function authFlow(context: APIContext, next: MiddlewareNext) {
  const { cookies, locals, url } = context;
  const currentPath = url.pathname;
  const runtime = locals.runtime;

  // Orion: Si no hay base de datos, saltamos la auth de D1
  const db = runtime?.env?.DB ? getDB(runtime.env) : undefined;
  locals.db = db;
  locals.user = undefined;

  const authCookie = cookies.get('user_auth')?.value;
  const sessionId = cookies.get('user_session')?.value;
  const isAdminRoute = currentPath.startsWith('/admin');

  // 1. FAST-PATH: Verificación JWT (Zero D1 Reads - 15 min expiración)
  // Orion: Si es una ruta Admin, saltamos el Fast-Path para garantizar seguridad máxima
  if (authCookie && runtime?.env?.JWT_SECRET && !isAdminRoute) {
    const payload = await verifyToken(authCookie, runtime.env.JWT_SECRET);
    if (payload) {
      // Verificación de Blacklist en KV (Revocación individual de JWTs)
      const isRevoked = payload.jti
        ? await runtime?.env?.KV_VIEWS?.get(`revoked:${payload.jti}`)
        : false;

      if (!isRevoked) {
        locals.user = {
          uid: payload.uid,
          email: payload.email,
          username: payload.username || undefined,
          displayName: payload.displayName || undefined,
          isAdmin: payload.role === 'admin' || payload.uid === runtime.env.SUPER_ADMIN_UID,
          isNsfw: payload.isNsfw,
          tokenVersion: payload.tokenVersion,
        };
      } else {
        // Token revocado -> Limpiar cookies
        deleteSession(context as any);
      }
    }
  }

  // 2. SLOW-PATH: Verificación de sesión en D1 (Si el JWT expiró, no existe, es ruta Admin, o necesitamos revalidar)
  if ((!locals.user || isAdminRoute) && sessionId && db && !locals.isBot) {
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

        // Orion: Validación de Seguridad Nuclear - Verificar tokenVersion si venimos de un JWT
        if (authCookie && isAdminRoute && runtime?.env?.JWT_SECRET) {
          const payload = await verifyToken(authCookie, runtime.env.JWT_SECRET);
          if (payload && payload.tokenVersion !== result.user.tokenVersion) {
            // La versión del token no coincide con la DB -> Sesión comprometida o revocada
            deleteSession(context as any);
            return context.redirect('/');
          }
        }

        const userObj = {
          uid,
          email: result.user.email,
          username: result.user.username || undefined,
          displayName: result.user.displayName || undefined,
          avatarUrl: result.user.avatarUrl || undefined,
          isAdmin: role === 'admin',
          isNsfw: result.user.isNsfw ?? false,
          preferences: result.user.preferences || '{}',
          tokenVersion: result.user.tokenVersion,
        };
        locals.user = userObj;

        // Auto-refresh: Emitimos un nuevo JWT válido por 15 mins ya que la sesión D1 es válida
        if (runtime?.env?.JWT_SECRET) {
          await setAuthCookie(
            context as any,
            {
              uid: userObj.uid,
              email: userObj.email,
              username: userObj.username || null,
              displayName: userObj.displayName || null,
              role: role,
              isNsfw: userObj.isNsfw,
              tokenVersion: userObj.tokenVersion,
            },
            runtime.env.JWT_SECRET
          );
        }
      } else {
        // Sesión no válida en D1 (ej. expirada o usuario baneado/sesión borrada)
        deleteSession(context as any);
      }
    } catch (error) {
      logError(error, 'Auth Middleware Error');
      deleteSession(context as any);
    }
  }

  // Redirecciones de seguridad
  if (currentPath.startsWith('/admin') && !locals.user?.isAdmin) {
    return context.redirect('/');
  }

  return next();
}
