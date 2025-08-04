// src/lib/firebase/server.ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS_URL =
  'https://www.googleapis.com/service_account/v1/jwk/securetoken.google.com';

export async function verifyFirebaseToken(token: string, env: any) {
  // Hardcodea tu FIREBASE_PROJECT_ID para prueba
  const hardcodedProjectId = 'babylon-scanlation-users';
  const projectIdToUse = hardcodedProjectId || env.FIREBASE_PROJECT_ID;

  if (!projectIdToUse) {
    throw new Error(
      'La variable de entorno FIREBASE_PROJECT_ID no está configurada.'
    );
  }

  const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectIdToUse}`,
      audience: projectIdToUse,
    });

    return {
      ...payload,
      sub: payload.sub || payload.user_id,
    };
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    throw new Error('Token inválido o expirado');
  }
}
