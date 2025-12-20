import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies, redirect, request }) => {
  cookies.delete('user_session', {
    path: '/',
  });

  const accept = request.headers.get('accept');
  if (accept?.includes('application/json')) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return redirect('/');
};
