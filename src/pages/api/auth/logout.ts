import type { APIRoute } from 'astro';
import { auth } from '@lib/firebase/client';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  // Cerrar sesión en Firebase
  try {
    await auth.signOut();
  } catch (error) {
    console.error('Error cerrando sesión en Firebase:', error);
  }

  // Eliminar cookie de sesión
  cookies.delete('user_session', { path: '/' });

  return redirect('/');
};
