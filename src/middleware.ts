import { defineMiddleware } from 'astro:middleware';
import type { APIContext } from 'astro';
import { authFlow } from './lib/middlewares/auth';
import { shield } from './lib/middlewares/shield';

export const onRequest = defineMiddleware(async (context, next) => {
  // 1. Capa de Protección (Bot & Geo Block)
  const shieldResponse = await shield(context as any, async () => {
    // 2. Capa de Autenticación (JWT & D1 Session)
    return await authFlow(context, async () => {
      // 3. Ejecución de la Ruta
      const response = await next();

      // 4. Capa de Optimización de Headers (Edge Cache)
      return applyOptimizedHeaders(response, context);
    });
  });

  return shieldResponse;
});

function applyOptimizedHeaders(response: Response, context: APIContext) {
  const contentType = response.headers.get('content-type');
  const currentPath = context.url.pathname;

  if (contentType?.includes('text/html')) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Robots-Tag', 'index, follow, max-image-preview:large');

    // Orion: Si hay un usuario logueado, permitimos caché privado (Browser) pero NO en CDN
    if (context.locals.user) {
      response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
      // Importante: No pasamos 's-maxage' para asegurar que Cloudflare no lo sirva a otros
    } else {
      // Para invitados, permitimos un cacheo breve en rutas de contenido público
      if (
        currentPath.startsWith('/series/') ||
        currentPath === '/' ||
        currentPath.startsWith('/news/')
      ) {
        response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=5');
      } else {
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, no-transform');
        response.headers.set('cf-edge-cache', 'no-cache');
      }
    }
  }
  return response;
}
