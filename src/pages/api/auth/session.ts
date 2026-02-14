import type { APIRoute } from 'astro';
import { z } from 'zod';
import { verifyFirebaseToken } from '@lib/firebase/server';
import { logError } from '@lib/logError';
import { getDB } from '@lib/db';
import { generateRandomUsername, generateUUID } from '@lib/utils';
import { userRoles, sessions, users } from '../../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { setAuthCookie } from '@lib/session';

const SessionRequestSchema = z.object({
  idToken: z.string().min(1),
});

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  let idToken: string | undefined;
  let decodedToken: { sub: string | undefined; [key: string]: any } | null = null;

  try {
    const body = await request.json();
    const validation = SessionRequestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'El token de autenticación no fue proporcionado o tiene un formato inválido.' }),
        { status: 400 }
      );
    }

    idToken = validation.data.idToken;
    const { env } = locals.runtime;

    decodedToken = await verifyFirebaseToken(idToken, env);

    if (!decodedToken?.sub) {
      return new Response(JSON.stringify({ error: 'Token inválido: UID no encontrado o formato incorrecto.' }), { status: 401 });
    }

    const uid = String(decodedToken.sub);
    const db = getDB(env);

    if (!db) {
      throw new Error('No se pudo conectar a la base de datos');
    }

    // --- Orion: Sync User Profile to D1 ---
    const email = decodedToken.email || `${uid}@firebase.auth`;
    
    // Check if user exists to preserve username or generate a new one if missing
    const existingUser = await db.select().from(users).where(eq(users.id, uid)).get();
    let usernameToUse = existingUser?.username;

    if (!usernameToUse) {
      usernameToUse = generateRandomUsername();
    }

    await db.insert(users).values({
      id: uid,
      email: email,
      username: usernameToUse,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: sql`excluded.email`,
        username: sql`excluded.username`, // We safe to update because we fetched the existing one above
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    })
    .run();

    // --- Admin Check Optimization ---
    let role = 'user';
    const superAdminUid = env.SUPER_ADMIN_UID;

    if (superAdminUid && uid === superAdminUid) {
        role = 'admin';
    } else {
        try {
            const userRole = await db
                .select({ role: userRoles.role })
                .from(userRoles)
                .where(eq(userRoles.userId, uid))
                .get();
            
            if (userRole && userRole.role === 'admin') {
                role = 'admin';
            }
        } catch (dbError) {
            console.error('Error checking user role in session creation:', dbError);
        }
    }

    // --- Create Server-Side Session ---
    const sessionId = generateUUID();
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const expiresIn = 60 * 60 * 24 * 7; // 7 días en segundos
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    await db.insert(sessions).values({
      id: sessionId,
      userId: uid,
      userAgent: userAgent,
      expiresAt: expiresAt,
    }).run();

    const url = new URL(request.url);
    const isLocalIp = url.hostname.startsWith('192.168.') || url.hostname.startsWith('10.') || url.hostname.startsWith('172.');
    const isProduction = import.meta.env.PROD;
    
    // Si es IP local, desactivamos 'secure' incluso en PROD para permitir pruebas en red local sin HTTPS
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

    // Orion: Generamos el JWT para el Middleware (Zero D1 Read)
    const jwtSecret = env.JWT_SECRET || 'fallback-secret-change-me-in-production';
    await setAuthCookie({ cookies, request } as any, {
      uid,
      email: email,
      username: usernameToUse,
      displayName: existingUser?.displayName || decodedToken.name || null,
      role: role,
      isNsfw: existingUser?.isNsfw ?? false,
    }, jwtSecret);

    return new Response(JSON.stringify({ success: true, role }), { status: 200 });
  } catch (error: unknown) {
    logError(error, 'Error al crear la sesión');
    return new Response(JSON.stringify({ error: 'Falló la autenticación del usuario.' }), { status: 401 });
  }
};