import { env } from 'cloudflare:workers';
// src/lib/middlewares/auth.ts
import type { APIContext, MiddlewareNext } from 'astro';
import { and, eq, gt } from 'drizzle-orm';
import { scanlationMembers, sessions, userRoles, users } from '../../db/schema';
import type { SessionContext } from '../../types';
import { getDB } from '../db-client';
import { logError } from '../logError';
import { deleteSession, setAuthCookie, verifyToken } from '../session';

// Orion: Caché L1 en RAM para revocaciones de JWT (Ahorro de lecturas KV)
// Cacheamos el estado de revocación por 60 segundos por Isolate.
const revocationCache = new Map<string, { revoked: boolean; expires: number }>();

export function clearSessionCache(context: Pick<SessionContext, 'cookies'>) {
  // Borramos el cookie de auth para forzar al middleware a entrar en el SLOW-PATH (Lectura de DB)
  // Esto asegura que cualquier cambio de estado (como NSFW o Roles) se refleje inmediatamente.
  context.cookies.delete('user_auth', { path: '/' });
}

export async function authFlow(context: APIContext, next: MiddlewareNext) {
  const { cookies, locals, url } = context;
  const currentPath = url.pathname;

  // Orion: Si no hay base de datos, saltamos la auth de D1
  const db = env?.DB ? getDB(env) : undefined;
  locals.db = db;
  locals.user = undefined;

  const authCookie = cookies.get('user_auth')?.value;
  const sessionId = cookies.get('user_session')?.value;
  const isAdminRoute = currentPath.startsWith('/admin');

  // 1. FAST-PATH: Verificación JWT (Zero D1 Reads - 15 min expiración)
  // Orion: Si es una ruta Admin, saltamos el Fast-Path para garantizar seguridad máxima
  if (authCookie && env?.JWT_SECRET && !isAdminRoute) {
    const payload = await verifyToken(authCookie, env.JWT_SECRET);
    if (payload) {
      // Verificación de Blacklist en KV con Caché L1 en RAM (Orion: Optimización Crítica)
      const cacheKey = payload.jti || '';
      const now = Date.now();
      const cached = revocationCache.get(cacheKey);

      let isRevoked = false;
      if (cached && cached.expires > now) {
        isRevoked = cached.revoked;
      } else if (payload.jti && env?.KV_VIEWS) {
        isRevoked = !!(await env.KV_VIEWS.get(`revoked:${payload.jti}`));
        // Guardamos en RAM por 60 segundos
        revocationCache.set(cacheKey, { revoked: isRevoked, expires: now + 60000 });

        // Limpieza periódica aleatoria del caché
        if (Math.random() < 0.05) {
          for (const [k, v] of revocationCache.entries()) {
            if (v.expires < now) revocationCache.delete(k);
          }
        }
      }

      if (!isRevoked) {
        locals.user = {
          uid: payload.uid,
          email: payload.email,
          username: payload.username || undefined,
          displayName: payload.displayName || undefined,
          isAdmin: payload.role === 'admin' || payload.uid === env.SUPER_ADMIN_UID,
          isNsfw: payload.isNsfw,
          tokenVersion: payload.tokenVersion,
          scanlations: payload.scans?.map((id) => ({ id, role: 'editor' })) || [], // El rol 'editor' es el mínimo por defecto en fast-path
        };
      } else {
        // Token revocado -> Limpiar cookies
        deleteSession(context as unknown as SessionContext);
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
          env.SUPER_ADMIN_UID && uid === env.SUPER_ADMIN_UID ? 'admin' : result.role || 'user';

        // Orion: Validación de Seguridad Nuclear - Verificar tokenVersion si venimos de un JWT
        if (authCookie && isAdminRoute && env?.JWT_SECRET) {
          const payload = await verifyToken(authCookie, env.JWT_SECRET);
          if (payload && payload.tokenVersion !== result.user.tokenVersion) {
            // La versión del token no coincide con la DB -> Sesión comprometida o revocada
            deleteSession(context as unknown as SessionContext);
            return context.redirect('/');
          }
        }

        // Cargar membresías de Scanlation (Orion: RBAC Multi-tenant)
        const memberships = await db
          .select({
            id: scanlationMembers.scanlationId,
            role: scanlationMembers.role,
          })
          .from(scanlationMembers)
          .where(eq(scanlationMembers.userId, uid))
          .all();

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
          scanlations: memberships as { id: number; role: 'owner' | 'editor' | 'moderator' }[],
        };
        locals.user = userObj;

        // Auto-refresh: Emitimos un nuevo JWT válido por 15 mins ya que la sesión D1 es válida
        if (env?.JWT_SECRET) {
          await setAuthCookie(
            context as unknown as SessionContext,
            {
              uid: userObj.uid,
              email: userObj.email,
              username: userObj.username || userObj.email.split('@')[0] || 'usuario',
              displayName: userObj.displayName || null,
              role: role as 'admin' | 'user',
              isNsfw: userObj.isNsfw,
              tokenVersion: userObj.tokenVersion,
              scans: memberships.map((m) => m.id),
            },
            env.JWT_SECRET
          );
        }
      } else {
        // Sesión no válida en D1 (ej. expirada o usuario baneado/sesión borrada)
        deleteSession(context as unknown as SessionContext);
      }
    } catch (error) {
      logError(error, 'Auth Middleware Error');
      deleteSession(context as unknown as SessionContext);
    }
  }

  // Redirecciones de seguridad (Orion: Suavizado para Multi-tenant)
  const isScanMember = (locals.user?.scanlations?.length ?? 0) > 0;
  if (currentPath.startsWith('/admin') && !locals.user?.isAdmin && !isScanMember) {
    return context.redirect('/');
  }

  return next();
}
