import type { APIRoute } from 'astro';
import { z } from 'zod';
import { verifyFirebaseToken } from '@lib/firebase/server';
import { logError } from '@lib/logError';

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
        JSON.stringify({ error: 'Token no proporcionado o inválido' }),
        { status: 400 }
      );
    }

    idToken = validation.data.idToken;
    const { env } = locals.runtime;

    decodedToken = await verifyFirebaseToken(idToken, env);

    if (!decodedToken || !decodedToken.sub) {
      return new Response(
        JSON.stringify({ error: 'Token inválido, UID no encontrado o token malformado' }),
        { status: 401 }
      );
    }

    const expiresIn = 60 * 60 * 24 * 7; // 7 días
    const isProduction = import.meta.env.PROD;
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      maxAge: expiresIn,
      sameSite: 'lax' as const,
    };

    console.log('[Auth Session] Opciones de la cookie:', cookieOptions);

    cookies.set('user_session', idToken, cookieOptions);

    console.log('[Auth Session] Cookie de sesión establecida correctamente.');

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: unknown) {
    const errorForLog = error;
    logError(errorForLog, 'Error al crear la sesión', { idToken, uid: decodedToken?.sub });
    return new Response(JSON.stringify({ error: 'Autenticación fallida' }), {
      status: 401,
    });
  }
};
