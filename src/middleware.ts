// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { getDB } from './lib/db-client';
import { userRoles, sessions, users } from './db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { logError } from './lib/logError';
import { verifyToken, deleteSession } from './lib/session';

export const onRequest = defineMiddleware(async (context, next) => {
  // --- GEO-BLOCKING (Bloqueo por País) - PRIORIDAD 0 ---
  // JP, KR, CN: Riesgo Copyright. US: Riesgo IAs/DMCA.
  const blacklistedCountries = ['JP', 'KR', 'CN', 'US'];
  const country = context.request.headers.get('cf-ipcountry');

  // Plantilla HTML de Bloqueo (Estilo Cyberpunk/Nuclear)
  const getBlockedHTML = (reason: string, ip: string | null) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Access Denied</title>
      <style>
        body { background: #050505; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; overflow: hidden; }
        .container { text-align: center; padding: 2rem; max-width: 500px; border: 1px solid #333; background: #111; border-radius: 8px; box-shadow: 0 0 50px rgba(255, 0, 0, 0.1); }
        h1 { color: #ff3333; font-size: 2rem; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 2px; }
        p { color: #888; margin-bottom: 2rem; line-height: 1.6; }
        .details { font-family: monospace; background: #000; padding: 10px; border-radius: 4px; border: 1px solid #222; font-size: 0.9rem; color: #666; }
        .shield { font-size: 4rem; margin-bottom: 1rem; display: block; }
      </style>
    </head>
    <body>
      <div class="container">
        <span class="shield">🛡️</span>
        <h1>Access Denied</h1>
        <p>Your connection has been flagged by our security systems.<br>You are not allowed to access this resource.</p>
        <div class="details">Reason: ${reason}<br>Origin: ${ip || 'Unknown'}</div>
      </div>
    </body>
    </html>
  `;

  // --- ANTI-BOT & ANTI-IA SHIELD ---
  const userAgent = context.request.headers.get('user-agent') || '';
  const lowerUA = userAgent.toLowerCase();
  
  // Orion: Excepción para Googlebot y herramientas de Google (Imprescindible para SEO)
  const isGoogle = lowerUA.includes('google'); // Mucho más permisivo: bot, fetcher, ads, etc.

  if (country && blacklistedCountries.includes(country) && !isGoogle) {
    return new Response(getBlockedHTML(`Restricted Region (${country})`, country), {
      status: 403,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }

  const blockedBots = [
    // China / Asia
    'deepseek', 'qwen', 'tongyi', 'alibaba', 'aliyun', 'bytespider', 'bytedance', 'baiduspider', 'yisouspider',
    // US / Global AI
    'gptbot', 'chatgpt', 'google-extended', 'googleother', 'claudebot', 'anthropic', 'ccbot', 'perplexity', 'amazonbot', 'facebookbot', 'diffbot', 'pinterestbot', 'applebot',
    // Herramientas de Scraping Genéricas y Automatización
    'python', 'curl', 'wget', 'go-http-client', 'scrapy', 'java', 'axios', 'aiohttp', 'libwww-perl',
    'headless', 'playwright', 'puppeteer', 'selenium', 'webdriver', 'chrome-lighthouse'
  ];

  const currentPath = context.url.pathname;

  // Regla 1: Bloquear si coincide con la lista negra (EXCEPTO para la API de caché de imágenes y assets)
  if (!currentPath.startsWith('/api/r2-cache/') && !currentPath.startsWith('/api/assets/') && blockedBots.some(bot => lowerUA.includes(bot))) {
    return new Response(getBlockedHTML('Automated Traffic Detected', 'System'), { status: 403, headers: { 'Content-Type': 'text/html' } });
  }

  const runtime = context.locals.runtime;
  const db = runtime?.env?.DB ? getDB(runtime.env) : undefined;
  context.locals.db = db;
  context.locals.user = undefined;
  context.locals.isBot = isGoogle;

  const authCookie = context.cookies.get('user_auth')?.value;
  const sessionId = context.cookies.get('user_session')?.value;

  // --- Orion: JWT Fast-Path (Zero D1 Reads) ---
  if (authCookie && runtime?.env?.JWT_SECRET) {
    const payload = await verifyToken(authCookie, runtime.env.JWT_SECRET);
    if (payload) {
      context.locals.user = {
        uid: payload.uid,
        email: payload.email,
        username: payload.username || undefined,
        displayName: payload.displayName || undefined,
        photoURL: undefined, // El JWT no tiene avatar por ahora para ahorrar bytes
        emailVerified: false,
        isAdmin: payload.role === 'admin' || payload.uid === runtime.env.SUPER_ADMIN_UID,
        isNsfw: payload.isNsfw,
      } as any;
    }
  }

  // Si ya tenemos usuario por JWT, saltamos la consulta a D1
  if (!context.locals.user && sessionId && db) {
    try {
      const currentUserAgent = context.request.headers.get('user-agent') || 'unknown';

      // Orion: Consolidamos sesión y roles en un solo JOIN para ahorrar 1 round-trip a D1
      let result;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          result = await db
            .select({
              session: sessions,
              user: users,
              role: userRoles.role
            })
            .from(sessions)
            .innerJoin(users, eq(sessions.userId, users.id))
            .leftJoin(userRoles, eq(sessions.userId, userRoles.userId))
            .where(
              and(
                eq(sessions.id, sessionId),
                gt(sessions.expiresAt, Math.floor(Date.now() / 1000)),
                eq(sessions.userAgent, currentUserAgent)
              )
            )
            .get();
          break; // Success
        } catch (dbError) {
          attempts++;
          const isBusy = dbError instanceof Error && (dbError.message.includes('D1_BUSY') || dbError.message.includes('database is locked'));
          
          if (attempts >= maxAttempts || !isBusy) {
            console.error(`[Middleware] Error crítico en sesión (Intento ${attempts}/${maxAttempts}):`, dbError instanceof Error ? dbError.message : dbError);
            if (attempts >= maxAttempts) break; // Stop retrying
          }
          
          // Wait before retrying (exponential backoff: 100ms, 200ms, 400ms)
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempts - 1)));
        }
      }

      if (result && result.session) {
        const uid = result.session.userId;
        const superAdminUid = runtime.env.SUPER_ADMIN_UID;
        const isAdmin = (superAdminUid && uid === superAdminUid) || result.role === 'admin';

        context.locals.user = {
          uid,
          email: result.user.email,
          username: result.user.username || undefined,
          displayName: result.user.displayName || undefined,
          photoURL: result.user.avatarUrl || undefined,
          emailVerified: false,
          isAdmin: !!isAdmin,
          isNsfw: result.user.isNsfw ?? false,
        } as any;
      } else {
        deleteSession(context as any);
      }
    } catch (error) {
      logError(error, 'Error verificando sesión');
      deleteSession(context as any);
    }
  }

  const isVerified = context.cookies.get('site_verified')?.value === 'true';
  const isPublicPath =
    currentPath === '/verify' ||
    currentPath === '/terms' ||
    currentPath.startsWith('/sitemap') ||
    currentPath.startsWith('/api/') ||
    currentPath.startsWith('/js/') ||
    currentPath.startsWith('/_astro') ||
    currentPath.startsWith('/favicon.svg');

  if (!isVerified && !isPublicPath && !isGoogle) {
    return context.redirect('/verify');
  }

  if (currentPath.startsWith('/admin') && !context.locals.user?.isAdmin) {
    return context.redirect('/');
  }

  const response = await next();
  
  // Orion: Optimización de Cache-Control por ruta
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('text/html')) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Robots-Tag', 'index, follow, max-image-preview:large');
    
    // Si es una ruta de series o el index, permitimos cacheo suave en el edge
    if (currentPath.startsWith('/series/') || currentPath === '/' || currentPath.startsWith('/news/')) {
      response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
    } else {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, no-transform');
      response.headers.set('cf-edge-cache', 'no-cache');
    }
  }

  return response;
});
