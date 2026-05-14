import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';

/**
 * Middleware de compatibilidad para Astro v6 + Cloudflare.
 * Restaura 'context.locals.runtime.env' y 'context.locals.runtime.ctx' 
 * que fueron eliminados en el adaptador de Astro v6.
 */
export const compatibility = defineMiddleware(async (context, next) => {
  // En Astro v6, el objeto runtime ya no contiene 'env' ni 'ctx' directamente.
  // Inyectamos el objeto 'env' importado de 'cloudflare:workers' 
  // y el 'ctx' del objeto runtime original para mantener la compatibilidad.
  
  if (context.locals.runtime) {
    // @ts-expect-error - Forzamos la inyección para compatibilidad con código existente
    context.locals.runtime.env = env;
    
    // El objeto runtime de Astro v6 contiene las propiedades nativas de Cloudflare directamente.
    // Intentamos recuperar 'ctx' (que contiene waitUntil, etc.)
    if (!context.locals.runtime.ctx) {
      // @ts-expect-error
      context.locals.runtime.ctx = context.locals.runtime;
    }
  }

  return next();
});
