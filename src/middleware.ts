// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { getDB } from './lib/db';
import { verifyFirebaseToken } from './lib/firebase/server'; // <-- Usamos nuestra nueva función

export const onRequest = defineMiddleware(async (context, next) => {
  const runtime = context.locals.runtime;

  if (runtime?.env?.DB) {
    context.locals.db = getDB(runtime.env);
  }

  // --- NUEVA LÓGICA DE AUTENTICACIÓN ---
  const sessionCookie = context.cookies.get('user_session');
  context.locals.user = undefined; // Aseguramos que el usuario no esté definido por defecto

  if (sessionCookie?.value) {
    try {
      const decodedToken = await verifyFirebaseToken(
        sessionCookie.value,
        runtime.env
      );

      context.locals.user = {
        uid: decodedToken.sub!, // 'sub' (subject) es el UID del usuario en el token JWT
        email: (decodedToken.email as string) || null,
      };
    } catch (error: any) {
      // Si el token es inválido, lo eliminamos y continuamos como usuario no autenticado
      // console.error("Token de sesión inválido:", error.code || error.message);
      context.cookies.delete('user_session', { path: '/' });
    }
  }

  return next();
});
