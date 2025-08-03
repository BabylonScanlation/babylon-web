// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { getDB } from './lib/db';

export const onRequest = defineMiddleware((context, next) => {
  const runtime = context.locals.runtime;

  if (runtime?.env?.DB) {
    try {
      context.locals.db = getDB(runtime.env);
    } catch (error) {
      console.error(
        'Error al inicializar la base de datos en el middleware:',
        error
      );
    }
  }
  return next();
});
