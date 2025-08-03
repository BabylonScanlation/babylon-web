// src/pages/api/auth/session.ts
import type { APIRoute } from 'astro';
import { z } from 'zod';

const SessionRequestSchema = z.object({
  idToken: z.string().min(1),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const validation = SessionRequestSchema.safeParse(body);

    if (!validation.success) {
      return new Response("Token no proporcionado o inválido", { status: 400 });
    }

    const { idToken } = validation.data;
    const expiresIn = 60 * 60 * 24 * 7 * 1000; // 7 días

    // Simplemente guardamos el idToken en la cookie.
    // El middleware se encargará de verificarlo en cada petición.
    cookies.set('user_session', idToken, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      maxAge: expiresIn / 1000,
    });

    return new Response("Sesión creada", { status: 200 });
  } catch (error) {
    console.error("Error al crear la sesión:", error);
    return new Response("Autenticación fallida", { status: 401 });
  }
};