// src/lib/firebase/server.ts
import { jwtVerify, importJWK } from 'jose';

// Esta es la URL CORRECTA para obtener las claves de Firebase.
const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

interface Env {
  FIREBASE_PROJECT_ID: string;
}

interface JWK {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

export async function verifyFirebaseToken(token: string, env: Env) {
  const projectIdToUse = env.FIREBASE_PROJECT_ID;

  if (!projectIdToUse) {
    throw new Error(
      'La variable de entorno FIREBASE_PROJECT_ID no está configurada.'
    );
  }

  const res = await fetch(JWKS_URL);
  if (!res.ok) {
    const errorBody = await res.text();
    console.error(
      'Error fetching JWKS:',
      res.status,
      res.statusText,
      errorBody
    );
    throw new Error('Error al obtener las claves de verificación de Firebase.');
  }
  const jwks: { keys: JWK[] } = await res.json();

  // Map kid to imported key
  const kidToKey: Record<string, CryptoKey> = {};
  await Promise.all(
    jwks.keys.map(async (key: JWK) => {
      const imported = await importJWK(key, 'RS256');
      if (imported instanceof CryptoKey) {
        kidToKey[key.kid] = imported;
      } else {
        throw new Error('importJWK did not return a CryptoKey');
      }
    })
  );

  try {
    const { payload } = await jwtVerify(
      token,
      async (header: import('jose').JWTHeaderParameters) => {
        const key = kidToKey[header.kid as string];
        if (!key) {
          throw new Error('No matching JWK found for kid: ' + header.kid);
        }
        return key;
      },
      {
        issuer: `https://securetoken.google.com/${projectIdToUse}`,
        audience: projectIdToUse,
      }
    );

    return {
      ...payload,
      sub: payload.sub || payload.user_id,
    };
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    throw new Error('Token inválido o expirado');
  }
}
