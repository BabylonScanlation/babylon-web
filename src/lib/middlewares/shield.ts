// src/lib/middlewares/shield.ts
import type { APIContext, MiddlewareNext } from 'astro';
import { siteConfig } from '../../site.config';

// Orion: Rate Limiter distribuido vía Cloudflare KV
const MAX_REQ_PER_WINDOW = 200; // Máximo por IP en la ventana de tiempo

async function checkRateLimit(ip: string, env: any): Promise<boolean> {
  if (!ip || !env?.KV_VIEWS) return true; // Si no hay IP o KV, no bloqueamos (salvaguarda)

  const key = `rl:${ip}`;
  try {
    const record = await env.KV_VIEWS.get(key);
    const count = record ? parseInt(record) + 1 : 1;
    
    // Usamos expirationTtl para que la clave se borre automáticamente después de 1 minuto
    await env.KV_VIEWS.put(key, count.toString(), { expirationTtl: 60 });
    
    if (count > MAX_REQ_PER_WINDOW) {
      return false; // Rate limit excedido
    }
  } catch (e) {
    console.error('[Shield] Rate Limit KV Error:', e);
    return true; // En caso de error en KV, permitimos el paso por seguridad
  }

  return true;
}

export async function shield(context: APIContext, next: MiddlewareNext) {
  const { request, url, locals } = context;
  const { env } = locals.runtime;
  const userAgent = request.headers.get('user-agent') || '';
  const lowerUa = userAgent.toLowerCase();
  const currentPath = url.pathname;
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

  // 1. BYPASS para Googlebot y SEO (Esencial para indexación)
  const isGoogle = lowerUa.includes('google') || lowerUa.includes('sitemaps');
  locals.isBot = isGoogle;

  // 0. VERIFY REDIRECT (Optimización Crítica para evitar doble petición a la Home)
  const isVerified = context.cookies.get('site_verified')?.value === 'true';
  const isPublicPath =
    currentPath === '/verify' ||
    currentPath === '/terms' ||
    currentPath.includes('manifest.json') ||
    currentPath === '/index.json' ||
    currentPath.startsWith('/repo/') ||
    currentPath.startsWith('/api/') ||
    currentPath.startsWith('/_actions/') ||
    currentPath.startsWith('/js/') ||
    currentPath.startsWith('/_astro') ||
    currentPath.startsWith('/favicon.png');

  if (!isVerified && !isPublicPath && !isGoogle) {
    // Orion: Usamos rewrite en lugar de redirect para servir el contenido de verificación
    // instantáneamente sin disparar una segunda petición del navegador.
    return context.rewrite('/verify');
  }

  if (
    currentPath.endsWith('.xml') ||
    currentPath.includes('sitemap') ||
    currentPath === '/manifest.json' ||
    currentPath === '/index.json' ||
    currentPath.startsWith('/repo/') ||
    currentPath === '/sw.js'
  ) {
    return next();
  }

  // 2. RATE LIMITING (Protección contra DDoS/Fuerza bruta a nivel de aplicación)
  if (!isGoogle && !(await checkRateLimit(clientIp, env))) {
    return new Response(getBlockedHtml('Too Many Requests. Rate Limit Exceeded.', clientIp), {
      status: 429,
      headers: { 'Content-Type': 'text/html', 'Retry-After': '60' },
    });
  }

  // 3. GEO-BLOCKING
  const country = request.headers.get('cf-ipcountry');
  const blacklistedCountries = siteConfig.security.blacklistedCountries;

  if (country && blacklistedCountries.includes(country) && !isGoogle) {
    return new Response(getBlockedHtml('Geographic Restriction', country), {
      status: 403,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // 3. BOT-SHIELD (IA & Scrapers)
  const blockedBots = siteConfig.security.blockedBots;
  const isAssetPath =
    currentPath.startsWith('/api/r2-cache/') ||
    currentPath.startsWith('/api/assets/') ||
    currentPath === '/index.json' ||
    currentPath.startsWith('/repo/');

  if (!isAssetPath && blockedBots.some((bot) => lowerUa.includes(bot))) {
    return new Response(getBlockedHtml('Automated Traffic Detected', 'Security System'), {
      status: 403,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  return next();
}

function getBlockedHtml(reason: string, ip: string | null) {
  const siteName = siteConfig.name;
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Access Denied - ${siteName}</title>
      <style>
        body { background: #050505; color: #e0e0e0; font-family: -apple-system, sans-serif; height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
        .container { text-align: center; padding: 2rem; max-width: 500px; border: 1px solid #333; background: #111; border-radius: 8px; box-shadow: 0 0 50px rgba(255, 0, 0, 0.1); }
        h1 { color: #ff3333; font-size: 2rem; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 2px; }
        .details { font-family: monospace; background: #000; padding: 10px; border-radius: 4px; border: 1px solid #222; font-size: 0.9rem; color: #666; margin-top: 2rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <span style="font-size: 4rem;">🛡️</span>
        <h1>Access Denied</h1>
        <p>Your connection has been flagged by our security systems.<br>You are not allowed to access this resource.</p>
        <div class="details">Reason: ${reason}<br>Origin: ${ip || 'Unknown'}</div>
      </div>
    </body>
    </html>
  `;
}
