// src/pages/api/admin-logout.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies, redirect, request }) => {
  console.log('>>> [DEBUG] API Admin Logout endpoint hit.');
  try {
    cookies.delete('session', { path: '/' });

    // Obtenemos la URL de la página anterior.
    const referer = request.headers.get('Referer') || '/admin';

    // Añadimos el mensaje de éxito a la URL y redirigimos.
    const successUrl = new URL(referer);
    successUrl.searchParams.set('success', 'Sesión cerrada con éxito');

    console.log(
      `>>> [DEBUG] Session cookie deleted, redirecting to ${successUrl.toString()}.`
    );
    return redirect(successUrl.toString());
  } catch (e: unknown) {
    console.error('>>> [DEBUG] Error in API Admin Logout endpoint:', e);
    return new Response(
      `Internal Server Error en API Logout: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 }
    );
  }
};
