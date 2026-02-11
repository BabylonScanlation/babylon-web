import type { APIRoute } from 'astro';
import { logError } from '@lib/logError';
import { getDB } from '@lib/db';
import { getSeriesDetails } from '@lib/data/series';

export const GET: APIRoute = async ({ params, locals }) => {
  const { slug } = params;
  if (!slug) {
    return new Response('Se requiere el slug de la serie', { status: 400 });
  }

  try {
    const drizzleDb = getDB(locals.runtime.env);
    const user = locals.user;

    const responseData = await getSeriesDetails(
      drizzleDb, 
      slug, 
      user ? { uid: user.uid, isAdmin: !!user.isAdmin } : undefined
    );

    if (!responseData) {
      return new Response('Serie no encontrada', { status: 404 });
    }

    return new Response(JSON.stringify(responseData), {
      headers: {
        'content-type': 'application/json',
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    logError(error, 'Error en API series/[slug]', { slug });
    return new Response('Error interno', { status: 500 });
  }
};
