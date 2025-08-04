import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('user_session', {
    path: '/',
    domain: import.meta.env.PROD ? 'babylon-scanlation.pages.dev' : '',
  });

  return redirect('/');
};
