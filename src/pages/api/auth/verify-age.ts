import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies, request }) => {
  const url = new URL(request.url);

  // Detección de entorno para seguridad de cookies
  const isLocalIp =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.startsWith('192.168.') ||
    url.hostname.startsWith('10.') ||
    url.hostname.startsWith('172.');

  // Intentamos obtener PROD de locals si estuviera disponible,
  // pero en un endpoint API simple usamos la hostname como pista confiable.
  const isProduction = !isLocalIp;

  cookies.set('site_verified', 'true', {
    path: '/',
    httpOnly: false, // Permitimos lectura desde JS si fuera necesario
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 semana
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
