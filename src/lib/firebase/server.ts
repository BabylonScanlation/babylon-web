// src/lib/firebase/server.ts
import { createRemoteJWKSet, jwtVerify } from 'jose';
// No se necesita "import type { App } from 'astro/app';" porque Astro lo hace global.

// URL donde Google publica las claves para verificar los tokens de Firebase
const JWKS_URL =
  'https://www.googleapis.com/service_account/v1/jwk/securetoken.google.com';

/**
 * Verifica un token de ID de Firebase usando `jose`, que es compatible con Edge runtimes.
 * @param token - El token de ID de Firebase a verificar.
 * @param env - Las variables de entorno de Cloudflare.
 * @returns El token decodificado si es válido.
 * @throws Si el token es inválido o ha expirado.
 */
export async function verifyFirebaseToken(
  token: string,
  env: App.Locals['runtime']['env']
) {
  if (!env.FIREBASE_PROJECT_ID) {
    throw new Error(
      'La variable de entorno FIREBASE_PROJECT_ID no está configurada.'
    );
  }

  const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
    audience: env.FIREBASE_PROJECT_ID,
  });

  return payload;
}
