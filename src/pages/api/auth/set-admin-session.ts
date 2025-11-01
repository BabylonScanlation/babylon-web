import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies }) => {
  cookies.set('session', 'admin-logged-in', {
    path: '/',
    httpOnly: true,
    secure: !import.meta.env.DEV,
    maxAge: 60 * 60 * 24,
  });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
