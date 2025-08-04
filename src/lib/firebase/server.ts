// src/lib/firebase/server.ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS_URL =
  'https://www.googleapis.com/service_account/v1/jwk/securetoken.google.com';

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

export async function verifySessionCookie(cookie: string, env: any) {
  const JWKS = createRemoteJWKSet(
    new URL(
      'https://www.googleapis.com/service_account/v1/jwk/securetoken@system.gserviceaccount.com'
    )
  );

  const { payload } = await jwtVerify(cookie, JWKS, {
    issuer: `https://session.firebase.google.com/${env.FIREBASE_PROJECT_ID}`,
    audience: env.FIREBASE_PROJECT_ID,
  });

  return {
    uid: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
    lastLogin: payload.auth_time
      ? new Date(Number(payload.auth_time) * 1000).toISOString()
      : null,
  };
}
