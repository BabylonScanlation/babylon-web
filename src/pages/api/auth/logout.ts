import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('user_session', { path: '/' });
  return redirect('/');
};
