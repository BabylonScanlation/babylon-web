// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { getDB } from './lib/db';
import { getFirebaseAuth } from './lib/firebase/server'; // <--- Importamos la función de autenticación

export const onRequest = defineMiddleware(async (context, next) => {
  const runtime = context.locals.runtime;

  // 1. Inicialización de la base de datos (lógica existente)
  if (runtime?.env?.DB) {
    try {
      context.locals.db = getDB(runtime.env);
    } catch (error) {
      console.error(
        'Error al inicializar la base de datos en el middleware:',
        error
      );
    }
  }

  // --- INICIO DE LA LÓGICA DE AUTENTICACIÓN AÑADIDA ---

  // 2. Obtenemos la cookie de sesión del usuario
  const sessionCookie = context.cookies.get('user_session');

  if (sessionCookie?.value) {
    try {
      // 3. Verificamos el token de la cookie con Firebase Admin
      const auth = getFirebaseAuth(runtime.env);
      const decodedToken = await auth.verifyIdToken(sessionCookie.value);

      // 4. Si el token es válido, guardamos los datos del usuario
      context.locals.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
      };
    } catch (error) {
      // Si el token es inválido o expiró, lo eliminamos
      console.error('Error al verificar el token de sesión:', error);
      context.cookies.delete('user_session', { path: '/' });
      context.locals.user = undefined;
    }
  } else {
    // Si no hay cookie, nos aseguramos de que no haya un usuario en sesión
    context.locals.user = undefined;
  }
  // --- FIN DE LA LÓGICA DE AUTENTICACIÓN ---

  // 5. Continuamos con la petición
  return next();
});
