import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies, request }) => {
  const url = new URL(request.url);
  const isLocalIp =
    url.hostname.startsWith('192.168.') ||
    url.hostname.startsWith('10.') ||
    url.hostname.startsWith('172.');
  const isProduction = import.meta.env.PROD;

  cookies.set('site_verified', 'true', {
    path: '/',
    httpOnly: false, // Permitir lectura por JS
    secure: isProduction && !isLocalIp,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
