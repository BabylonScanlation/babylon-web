// src/lib/middlewares/shield.ts
import { siteConfig } from '../../site.config';

export async function shield(context: any, next: any) {
  const { request, url, locals } = context;
  const userAgent = request.headers.get('user-agent') || '';
  const lowerUA = userAgent.toLowerCase();
  const currentPath = url.pathname;
  
  // 1. BYPASS para Googlebot y SEO (Esencial para indexación)
  const isGoogle = lowerUA.includes('google') || lowerUA.includes('sitemaps');
  locals.isBot = isGoogle;

  if (
    currentPath.endsWith('.xml') || 
    currentPath.includes('sitemap') || 
    currentPath === '/manifest.json' || 
    currentPath === '/sw.js'
  ) {
    return next();
  }

  // 2. GEO-BLOCKING
  const country = request.headers.get('cf-ipcountry');
  const blacklistedCountries = siteConfig.security.blacklistedCountries;

  if (country && blacklistedCountries.includes(country) && !isGoogle) {
    return new Response(getBlockedHTML('Geographic Restriction', country), { 
      status: 403, 
      headers: { 'Content-Type': 'text/html' } 
    });
  }

  // 3. BOT-SHIELD (IA & Scrapers)
  const blockedBots = siteConfig.security.blockedBots;
  const isAssetPath = currentPath.startsWith('/api/r2-cache/') || currentPath.startsWith('/api/assets/');

  if (!isAssetPath && blockedBots.some(bot => lowerUA.includes(bot))) {
    return new Response(getBlockedHTML('Automated Traffic Detected', 'Security System'), { 
      status: 403, 
      headers: { 'Content-Type': 'text/html' } 
    });
  }

  // 4. VERIFY REDIRECT (Para usuarios que no han aceptado términos)
  const isVerified = context.cookies.get('site_verified')?.value === 'true';
  const isPublicPath =
    currentPath === '/verify' ||
    currentPath === '/terms' ||
    currentPath.startsWith('/api/') ||
    currentPath.startsWith('/js/') ||
    currentPath.startsWith('/_astro') ||
    currentPath.startsWith('/favicon.svg');

  if (!isVerified && !isPublicPath && !isGoogle) {
    return context.redirect('/verify');
  }

  return next();
}

function getBlockedHTML(reason: string, ip: string | null) {
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
