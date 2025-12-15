import type { APIRoute } from 'astro';
import { z } from 'zod';
import { verifyFirebaseToken } from '@lib/firebase/server';

const SessionRequestSchema = z.object({
  idToken: z.string().min(1),
});

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const body = await request.json();
    const validation = SessionRequestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Token no proporcionado o inválido' }),
        { status: 400 }
      );
    }

    const { idToken } = validation.data;
    const { env } = locals.runtime;

    const decodedToken = await verifyFirebaseToken(idToken, env);
    const uid = decodedToken.sub;

    if (!uid) {
      return new Response(
        JSON.stringify({ error: 'Token inválido, UID no encontrado' }),
        { status: 401 }
      );
    }

    const expiresIn = 60 * 60 * 24 * 7; // 7 días
    const isProduction = import.meta.env.PROD;

    console.log(
      `[Auth Session] Entorno: ${isProduction ? 'Producción' : 'Desarrollo'}`
    );

    const cookieOptions = {
      path: '/',
      httpOnly: true,
      secure: isProduction, // <-- LA CORRECCIÓN CLAVE
      maxAge: expiresIn,
      sameSite: 'lax' as const,
    };

    console.log('[Auth Session] Opciones de la cookie:', cookieOptions);

    cookies.set('user_session', idToken, cookieOptions);

    console.log('[Auth Session] Cookie de sesión establecida correctamente.');

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Error al crear la sesión:', error);
    return new Response(JSON.stringify({ error: 'Autenticación fallida' }), {
      status: 401,
    });
  }
};
