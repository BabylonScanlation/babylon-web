import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { eq, sql } from 'drizzle-orm';
import { anonymousUsers, sessions, userRoles, users } from '../db/schema';
import { hashIpAddress } from '../lib/crypto';
import { getDB } from '../lib/db';
import { verifyFirebaseToken } from '../lib/firebase/server';
import { deleteSession, setAuthCookie } from '../lib/session';
import { generateRandomUsername, generateUUID } from '../lib/utils';

export const authActions = {
  logout: defineAction({
    handler: async (_, context) => {
      const { cookies, locals } = context;
      const sessionId = cookies.get('user_session')?.value;
      const db = getDB(locals.runtime.env);

      if (sessionId && db) {
        try {
          await db.delete(sessions).where(eq(sessions.id, sessionId)).run();
        } catch (e) {
          console.error('Error deleting session from DB on logout:', e);
        }
      }

      deleteSession(context as any);
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
              updatedAt: new Date(),
              fingerprintHash: fingerprint || null,
            },
          })
          .run();
      }

      const url = new URL(request.url);
      const isLocalIp =
        url.hostname.startsWith('192.168.') ||
        url.hostname.startsWith('10.') ||
        url.hostname.startsWith('172.');
      const isProduction = context.locals.runtime.env.PROD || false;

      cookies.set('guestId', guestId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: false,
        secure: isProduction && !isLocalIp,
        sameSite: 'lax',
      });

      return { guestId, restored, isNew };
    },
  }),

  verifyAge: defineAction({
    handler: async (_, context) => {
      const { cookies, request } = context;
      const url = new URL(request.url);
      const isLocalIp =
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname.startsWith('192.168.') ||
        url.hostname.startsWith('10.') ||
        url.hostname.startsWith('172.');

      const isProduction = !isLocalIp;

      cookies.set('site_verified', 'true', {
        path: '/',
        httpOnly: false, // Permitir acceso desde JS para que el frontend reaccione al instante
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 1 semana
      });

      return { success: true };
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

      const decodedToken = await verifyFirebaseToken(idToken, env);
      if (!decodedToken?.sub) {
        throw new Error('Token de Firebase inválido');
      }

      const uid = String(decodedToken.sub);
      const db = getDB(env);

      const email = (decodedToken as any).email || `${uid}@firebase.auth`;
      const existingUser = await db.select().from(users).where(eq(users.id, uid)).get();
      const usernameToUse = existingUser?.username || generateRandomUsername();

      await db
        .insert(users)
        .values({
          id: uid,
          email: email,
          username: usernameToUse,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: sql`excluded.email`,
            username: sql`excluded.username`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .run();

      let role = 'user';
      const superAdminUid = env.SUPER_ADMIN_UID;

      if (superAdminUid && uid === superAdminUid) {
        role = 'admin';
      } else {
        const userRole = await db
          .select({ role: userRoles.role })
          .from(userRoles)
          .where(eq(userRoles.userId, uid))
          .get();
        if (userRole && userRole.role === 'admin') {
          role = 'admin';
        }
      }

      const sessionId = generateUUID();
      const userAgent = request.headers.get('user-agent') || 'unknown';
      const expiresIn = 60 * 60 * 24 * 7;
      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

      await db
        .insert(sessions)
        .values({
          id: sessionId,
          userId: uid,
          userAgent: userAgent,
          expiresAt: expiresAt,
        })
        .run();

      const url = new URL(request.url);
      const isLocalIp =
        url.hostname.startsWith('192.168.') ||
        url.hostname.startsWith('10.') ||
        url.hostname.startsWith('172.');
      const isProduction = context.locals.runtime.env.PROD || false;
      const secureFlag = isProduction && !isLocalIp;

      const cookieOptions = {
        path: '/',
        httpOnly: true,
        secure: secureFlag,
        maxAge: expiresIn,
        sameSite: 'lax' as const,
      };

      cookies.set('user_session', sessionId, cookieOptions);
      cookies.set('user_role', role, { ...cookieOptions, httpOnly: true });

      const jwtSecret = env.JWT_SECRET || 'fallback-secret-change-me-in-production';
      await setAuthCookie(
        { cookies, request } as any,
        {
          uid,
          email: email,
          username: usernameToUse,
          displayName: existingUser?.displayName || (decodedToken as any).name || null,
          role: role,
          isNsfw: existingUser?.isNsfw ?? false,
        },
        jwtSecret
      );

      return { success: true, role };
    },
  }),
};
