import { defineMiddleware } from 'astro:middleware';
import type { APIContext } from 'astro';
import { authFlow } from './lib/middlewares/auth';
import { shield } from './lib/middlewares/shield';

export const onRequest = defineMiddleware(async (context, next) => {
  // 1. Capa de Protección (Bot & Geo Block)
  const shieldResponse = await shield(context, async () => {
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

    // Orion: Aseguramos que el caché varíe según las cookies críticas
    response.headers.append('Vary', 'Cookie');

    // Orion: Optimizamos el caché para reducir carga en D1 (Auto-DDoS mitigation)
    if (context.locals.user) {
      // Si el usuario está logueado, permitimos un caché público corto en rutas de lectura
      // pero solo si no son rutas de administración.
      if (currentPath.startsWith('/series/') || currentPath.startsWith('/news/')) {
        response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=15');
        // Usamos 'Vary: Cookie' para que Cloudflare diferencie entre sesiones
      } else {
        response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
      }
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
