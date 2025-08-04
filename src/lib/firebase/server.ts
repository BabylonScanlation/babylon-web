import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS_URL =
  'https://www.googleapis.com/service_account/v1/jwk/securetoken.google.com';

export async function verifyFirebaseToken(token: string, env: any) {
  if (!env.FIREBASE_PROJECT_ID) {
    throw new Error(
      'La variable de entorno FIREBASE_PROJECT_ID no está configurada.'
    );
  }

  const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
    });

    // Ajuste específico para compatibilidad con Cloudflare
    return {
      ...payload,
      sub: payload.sub || payload.user_id,
    };
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    throw new Error('Token inválido o expirado');
  }
}
