// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { getDB } from './lib/db';

export const onRequest = defineMiddleware(async (context, next) => {
  const runtime = context.locals.runtime;

  if (runtime?.env?.DB) {
    context.locals.db = getDB(runtime.env);
  }

  // Inicializamos el usuario como indefinido
  context.locals.user = undefined;

  const sessionCookie = context.cookies.get('user_session');

  // Si la cookie de sesión existe, su valor es el UID. Confiamos en él.
  if (sessionCookie?.value) {
    context.locals.user = {
      uid: sessionCookie.value,
      email: null, // El email no es necesario aquí para saber si está logueado
    };
  }

  return next();
});
