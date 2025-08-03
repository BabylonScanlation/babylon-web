// src/lib/firebase/server.ts
import { initializeApp, getApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// --- CORRECCIÓN ---
// No se necesita importar el tipo, ya que Astro lo hace disponible globalmente.
// Simplemente usamos el namespace `App` que se define en `env.d.ts`.

// Función para inicializar Firebase Admin App de forma segura
function initializeFirebaseAdmin(env: App.Locals['runtime']['env']) {
  if (getApps().length > 0) {
    return getApp();
  }

  const serviceAccount = {
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    // La clave privada se decodifica correctamente
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  };

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

// Exportamos una función para obtener la instancia de Auth
export function getFirebaseAuth(env: App.Locals['runtime']['env']) {
  const app = initializeFirebaseAdmin(env);
  return getAuth(app);
}