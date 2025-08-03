// src/pages/api/auth/session.ts
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
      return new Response('Token no proporcionado o inválido', { status: 400 });
    }

    const { idToken } = validation.data;
    const { env } = locals.runtime;

    // ✅ Usamos la verificación del lado del servidor que ya tenías
    const decodedToken = await verifyFirebaseToken(idToken, env);
    const uid = decodedToken.sub; // 'sub' (subject) es el UID

    if (!uid) {
      return new Response('Token inválido, UID no encontrado', { status: 401 });
    }

    const expiresIn = 60 * 60 * 24 * 7; // 7 días en segundos

    // ✅ Guardamos solo el UID en la cookie de sesión
    cookies.set('user_session', uid, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      maxAge: expiresIn,
      sameSite: 'lax',
    });

    return new Response('Sesión creada', { status: 200 });
  } catch (error) {
    console.error('Error al crear la sesión:', error);
    return new Response('Autenticación fallida', { status: 401 });
  }
};
