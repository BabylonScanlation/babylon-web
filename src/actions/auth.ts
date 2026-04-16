import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { eq, sql } from 'drizzle-orm';
import { anonymousUsers, sessions, userRoles, users } from '../db/schema';
import { hashIpAddress } from '../lib/crypto';
import { getDB } from '../lib/db';
import { verifyFirebaseToken } from '../lib/firebase/server';
import { createNonce } from '../lib/nonce';
import { deleteSession, setAuthCookie } from '../lib/session';
import { generateRandomUsername, generateUUID } from '../lib/utils';
import type { AppDatabase, FirebaseDecodedToken, SessionContext } from '../types';

async function determineUserRole(db: AppDatabase, uid: string, superAdminUid: string | undefined) {
  if (superAdminUid && uid === superAdminUid) {
    return 'admin';
  }
  const userRole = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, uid))
    .get();
  return userRole?.role === 'admin' ? 'admin' : 'user';
}

export const authActions = {
  generateNonce: defineAction({
    handler: async (_, context) => {
      const { user, runtime } = context.locals;
      if (!user) throw new Error('Usuario no autenticado');
      const secret = runtime.env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET is not configured');
      return await createNonce(secret, user.uid);
    },
  }),

  logout: defineAction({
    handler: async (_, context) => {
      const { cookies, locals } = context;
      const sessionId = cookies.get('user_session')?.value;
      const db = getDB(locals.runtime.env);

      if (sessionId && db) {
        try {
          await db.delete(sessions).where(eq(sessions.id, sessionId)).run();
        } catch (e: unknown) {
          console.error('Error deleting session from DB on logout:', (e as Error).message);
        }
      }

      deleteSession(context as unknown as SessionContext);
      return { success: true };
    },
  }),

  registerGuest: defineAction({
    input: z.object({
      fingerprint: z.string().optional(),
    }),
    handler: async (input, context) => {
      const { fingerprint } = input;
      const { cookies, request, locals } = context;
      const db = getDB(locals.runtime.env);

      const rawIp = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ip = await hashIpAddress(rawIp);
      const userAgent = request.headers.get('User-Agent') || 'unknown';
      const country = request.headers.get('CF-IPCountry') || null;

      let guestId = cookies.get('guestId')?.value;
      let isNew = false;
      let restored = false;

      if (!guestId && fingerprint) {
        const existing = await db
          .select()
          .from(anonymousUsers)
          .where(eq(anonymousUsers.fingerprintHash, fingerprint))
          .get();
        if (existing) {
          guestId = existing.guestId;
          restored = true;
        }
      }

      if (!guestId) {
        guestId = generateUUID();
        isNew = true;
        await db
          .insert(anonymousUsers)
          .values({
            guestId,
            fingerprintHash: fingerprint || null,
            lastIpAddress: ip,
            userAgent,
            country,
          })
          .run();
      } else {
        await db
          .insert(anonymousUsers)
          .values({
            guestId,
            fingerprintHash: fingerprint || null,
            lastIpAddress: ip,
            userAgent,
            country,
          })
          .onConflictDoUpdate({
            target: anonymousUsers.guestId,
            set: {
              lastIpAddress: ip,
              userAgent,
              country,
              updatedAt: new Date().toISOString(),
              fingerprintHash: fingerprint || null,
            },
          })
          .run();
      }

      const url = new URL(request.url);
      const isLocal =
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname.startsWith('192.168.') ||
        url.hostname.startsWith('10.') ||
        url.hostname.startsWith('172.');

      cookies.set('guestId', guestId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: false,
        secure: !isLocal,
        sameSite: 'lax',
      });

      return { guestId, restored, isNew };
    },
  }),

  verifyAge: defineAction({
    input: z.object({
      token: z.string(),
    }),
    handler: async (input, context) => {
      try {
        const { token } = input;
        const { cookies, request, locals } = context;

        // Orion: Verificación robusta del entorno Cloudflare
        const runtime = locals.runtime;
        if (!runtime || !runtime.env) {
          console.error('[VerifyAge] Cloudflare runtime or env is missing in locals');
          // En desarrollo local a veces Astro no inyecta el runtime en las acciones
          // dependiendo de cómo se llame. Intentamos usar variables de entorno globales si fallan las de Cloudflare.
          if (import.meta.env.DEV) {
            console.warn(
              '[VerifyAge] Falling back to global process.env or import.meta.env in DEV'
            );
          } else {
            throw new Error('Error interno de configuración (Runtime missing)');
          }
        }

        const env = runtime?.env || (import.meta.env as Record<string, string | undefined>);
        const isDev = import.meta.env.DEV;

        // Orion: Selección de la clave secreta basada en el entorno.
        // Soporta ambos órdenes: SECRET_DEV y DEV_SECRET
        const devKey = env.TURNSTILE_DEV_SECRET_KEY || env.TURNSTILE_SECRET_DEV_KEY;

        const secretKeySource = isDev
          ? devKey
            ? 'DEV_SECRET_KEY_FOUND'
            : 'TURNSTILE_SECRET_KEY (fallback)'
          : 'TURNSTILE_SECRET_KEY';

        const secretKey = isDev ? devKey || env.TURNSTILE_SECRET_KEY : env.TURNSTILE_SECRET_KEY;

        if (!secretKey) {
          console.error('[VerifyAge] Missing Secret Key. Available env keys:', Object.keys(env));
          throw new Error('Configuración de seguridad incompleta (Falta TURNSTILE_SECRET_KEY)');
        }

        if (token) {
          const formData = new FormData();
          formData.append('secret', secretKey);
          formData.append('response', token);
          formData.append('remoteip', request.headers.get('CF-Connecting-IP') || '');

          const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            body: formData,
            method: 'POST',
          });

          const outcome = (await result.json()) as {
            success: boolean;
            'error-codes'?: string[];
          };
          if (!outcome.success) {
            console.error('[VerifyAge] Turnstile validation failed:', {
              errorCodes: outcome['error-codes'],
              usingKeySource: secretKeySource,
              isDev,
            });
            throw new Error(
              'La verificación de seguridad ha fallado. Por favor, inténtalo de nuevo.'
            );
          }
        }

        const isProduction =
          !request.url.includes('localhost') && !request.url.includes('127.0.0.1');

        cookies.set('site_verified', 'true', {
          path: '/',
          httpOnly: false,
          secure: isProduction,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 1 semana
        });

        return { success: true };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Error desconocido';
        console.error('[VerifyAge Error]', message);
        throw e; // Astro Actions manejará esto y lo devolverá como un error 400/500 estructurado
      }
    },
  }),

  login: defineAction({
    input: z.object({
      idToken: z.string().min(1),
    }),
    handler: async (input, context) => {
      const { idToken } = input;
      const { env } = context.locals.runtime;
      const { cookies, request } = context;

      const decodedToken = (await verifyFirebaseToken(
        idToken,
        env
      )) as unknown as FirebaseDecodedToken;
      if (!decodedToken?.sub) {
        throw new Error('Token de Firebase inválido');
      }

      const uid = String(decodedToken.sub);
      const db = getDB(env);

      // Orion: Acceso seguro a propiedades dinámicas del JWT
      const email = decodedToken.email || `${uid}@firebase.auth`;
      const existingUser = await db.select().from(users).where(eq(users.id, uid)).get();
      const usernameToUse = existingUser?.username || generateRandomUsername();

      await db
        .insert(users)
        .values({ id: uid, email: email, username: usernameToUse })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: sql`excluded.email`,
            username: sql`excluded.username`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .run();

      const role = await determineUserRole(db, uid, env.SUPER_ADMIN_UID);
      const sessionId = generateUUID();
      const expiresIn = 60 * 60 * 24 * 7;
      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

      await db
        .insert(sessions)
        .values({
          id: sessionId,
          userId: uid,
          userAgent: request.headers.get('user-agent') || 'unknown',
          expiresAt: expiresAt,
        })
        .run();

      const isLocal = new URL(request.url).hostname === 'localhost';
      const secureFlag = !isLocal; // Cloudflare Pages siempre usa HTTPS, incluso en previews

      const cookieOptions = {
        path: '/',
        httpOnly: true,
        secure: secureFlag,
        maxAge: expiresIn,
        sameSite: 'lax' as const,
      };

      cookies.set('user_session', sessionId, cookieOptions);
      cookies.set('user_role', role, { ...cookieOptions, httpOnly: true });

      const jwtSecret = env.JWT_SECRET;
      if (!jwtSecret) throw new Error('JWT_SECRET is not configured');
      await setAuthCookie(
        context as unknown as SessionContext,
        {
          uid,
          email: email,
          username: usernameToUse,
          displayName: existingUser?.displayName || decodedToken.name || null,
          role: role,
          isNsfw: existingUser?.isNsfw ?? false,
          tokenVersion: existingUser?.tokenVersion ?? 1,
        },
        jwtSecret
      );

      return { success: true, role };
    },
  }),
};
