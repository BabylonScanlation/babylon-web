import { env } from 'cloudflare:workers';
// src/lib/middlewares/auth.ts
import type { APIContext, MiddlewareNext } from 'astro';
import { and, eq, gt } from 'drizzle-orm';
import { scanlationMembers, sessions, userRoles, users } from '../../db/schema';
import type { SessionContext } from '../../types';
import { getDB } from '../db-client';
import { logError } from '../logError';
import { deleteSession, setAuthCookie, verifyToken } from '../session';

// Orion: Cach├® L1 en RAM para revocaciones de JWT (Ahorro de lecturas KV)
// Cacheamos el estado de revocaci├│n por 60 segundos por Isolate.
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

  // 1. FAST-PATH: Verificaci├│n JWT (Zero D1 Reads - 15 min expiraci├│n)
  // Orion: Si es una ruta Admin, saltamos el Fast-Path para garantizar seguridad m├íxima
  if (authCookie && env?.JWT_SECRET && !isAdminRoute) {
    const payload = await verifyToken(authCookie, env.JWT_SECRET);
    if (payload) {
      // Verificaci├│n de Blacklist en KV con Cach├® L1 en RAM (Orion: Optimizaci├│n Cr├¡tica)
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

        // Limpieza peri├│dica aleatoria del cach├®
        if (Math.random() < 0.05) {
          for (const [k, v] of revocationCache.entries()) {
            if (v.expires < now) revocationCache.delete(k);
          }
        }
      }

      if (!isRevoked) {
        // Si el VIP ya expir├│ seg├║n el token, forzamos slow-path para que actualice la DB
        if (payload.vipExpiresAt && Date.now() > payload.vipExpiresAt) {
          // No seteamos locals.user, lo que forzar├í el slow-path m├ís abajo
        } else {
          locals.user = {
            uid: payload.uid,
            email: payload.email,
            username: payload.username || undefined,
            displayName: payload.displayName || undefined,
            isAdmin: payload.role === 'admin' || payload.uid === env.SUPER_ADMIN_UID,
            isNsfw: payload.isNsfw,
            tokenVersion: payload.tokenVersion,
            scanlations: payload.scans?.map((id) => ({ id, role: 'editor' })) || [], // El rol 'editor' es el m├¡nimo por defecto en fast-path
            vipTier: payload.vipTier || 0,
            vipExpiresAt: payload.vipExpiresAt || null,
          };
        }
      } else {
        // Token revocado -> Limpiar cookies
        deleteSession(context as unknown as SessionContext);
      }
    }
  }

  // 2. SLOW-PATH: Verificaci├│n de sesi├│n en D1 (Si el JWT expir├│, no existe, es ruta Admin, o necesitamos revalidar)
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

        // Orion: Validaci├│n de Seguridad Nuclear - Verificar tokenVersion si venimos de un JWT
        if (authCookie && isAdminRoute && env?.JWT_SECRET) {
          const payload = await verifyToken(authCookie, env.JWT_SECRET);
          if (payload && payload.tokenVersion !== result.user.tokenVersion) {
            // La versi├│n del token no coincide con la DB -> Sesi├│n comprometida o revocada
            deleteSession(context as unknown as SessionContext);
            return context.redirect('/');
          }
        }

        // Cargar membres├¡as de Scanlation (Orion: RBAC Multi-tenant)
        const memberships = await db
          .select({
            id: scanlationMembers.scanlationId,
            role: scanlationMembers.role,
          })
          .from(scanlationMembers)
          .where(eq(scanlationMembers.userId, uid))
          .all();

        // Validar expiraci├│n VIP
        const now = Date.now();
        let currentVipTier = result.user.vipTier || 0;
        let currentVipExpiresAt = result.user.vipExpiresAt
          ? result.user.vipExpiresAt.getTime()
          : null;

        if (currentVipExpiresAt && now > currentVipExpiresAt) {
          // VIP expirado -> Degradamos en DB (Slow path)
          currentVipTier = 0;
          currentVipExpiresAt = null;
          try {
            await db.update(users).set({ vipTier: 0, vipExpiresAt: null }).where(eq(users.id, uid));
          } catch (e) {
            console.error('Error degradando VIP', e);
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
          scanlations: memberships as { id: number; role: 'owner' | 'editor' | 'moderator' }[],
          vipTier: currentVipTier,
          vipExpiresAt: currentVipExpiresAt,
        };
        locals.user = userObj;

        // Auto-refresh: Emitimos un nuevo JWT v├ílido por 15 mins ya que la sesi├│n D1 es v├ílida
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
              vipTier: userObj.vipTier,
              vipExpiresAt: userObj.vipExpiresAt,
            },
            env.JWT_SECRET
          );
        }
      } else {
        // Sesi├│n no v├ílida en D1 (ej. expirada o usuario baneado/sesi├│n borrada)
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
