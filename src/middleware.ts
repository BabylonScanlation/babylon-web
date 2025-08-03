// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { getDB } from './lib/db';
// 'verifyFirebaseToken' ya no se usa aquí, así que se elimina la importación.

export const onRequest = defineMiddleware(async (context, next) => {
  const runtime = context.locals.runtime;

  if (runtime?.env?.DB) {
    context.locals.db = getDB(runtime.env);
  }

  // Por defecto, no hay usuario.
  context.locals.user = undefined;

  const sessionCookie = context.cookies.get('user_session');

  // Si la cookie de sesión existe, contiene el UID del usuario.
  // Confiamos en este UID para identificar al usuario autenticado.
  if (sessionCookie?.value) {
    try {
      context.locals.user = {
        uid: sessionCookie.value,
        // El email no es crítico para saber si está logueado, se puede generar un placeholder o dejarlo nulo.
        email: `user-${sessionCookie.value.substring(0, 8)}`,
      };
    } catch (error) {
      // En caso de un error inesperado al procesar la cookie, la eliminamos.
      context.cookies.delete('user_session', { path: '/' });
    }
  }

  return next();
});
