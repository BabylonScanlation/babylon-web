// src/pages/api/auth/login.ts
import type { APIRoute } from 'astro';
import { verifyFirebaseToken } from '@lib/firebase/server';

export const POST: APIRoute = async ({
  request,
  cookies,
  locals,
  redirect,
}) => {
  try {
    const formData = await request.formData();
    const idToken = formData.get('idToken')?.toString();

    if (!idToken) {
      // Idealmente, aquí se redirigiría a una página de error
      return new Response('Token no proporcionado.', { status: 400 });
    }

    const { env } = locals.runtime;
    const decodedToken = await verifyFirebaseToken(idToken, env);
    const uid = decodedToken.sub;

    if (!uid) {
      return new Response('Token de Firebase inválido.', { status: 401 });
    }

    // Se crea la cookie de sesión que durará 7 días
    const expiresIn = 60 * 60 * 24 * 7;
    cookies.set('user_session', uid, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      maxAge: expiresIn,
      sameSite: 'lax',
    });

    // ✅ Paso Clave: Redirigir al usuario a la página de inicio.
    // El código 303 (See Other) es el estándar para redirigir después de un POST.
    return redirect('/', 303);
  } catch (error) {
    console.error('Error en el endpoint de login:', error);
    // En caso de error, también se puede redirigir a una página con un mensaje.
    return new Response('Autenticación fallida.', { status: 401 });
  }
};
