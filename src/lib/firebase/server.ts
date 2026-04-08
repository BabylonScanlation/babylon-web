// src/lib/firebase/server.ts
import { importJWK, jwtVerify } from 'jose';
import { logError } from '../logError';

// Esta es la URL CORRECTA para obtener las claves de Firebase.
const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

interface Env {
  FIREBASE_PROJECT_ID: string;
  KV_VIEWS?: any;
}

interface Jwk {
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
    throw new Error('La variable de entorno FIREBASE_PROJECT_ID no está configurada.');
  }

  let jwks: { keys: Jwk[] };
  const CACHE_KEY = 'firebase_jwks';

  try {
    const cached = env.KV_VIEWS ? await env.KV_VIEWS.get(CACHE_KEY) : null;
    if (cached) {
      jwks = JSON.parse(cached);
    } else {
      const res = await fetch(JWKS_URL);
      if (!res.ok) {
        throw new Error(`Error fetching JWKS: ${res.statusText}`);
      }
      jwks = await res.json();
      if (env.KV_VIEWS) {
        await env.KV_VIEWS.put(CACHE_KEY, JSON.stringify(jwks), { expirationTtl: 3600 });
      }
    }
  } catch (e) {
    console.error('[Firebase] JWKS Cache Error:', e);
    // Fallback: intentar fetch directo si falla el KV
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error('Error al obtener las claves de Firebase.');
    jwks = await res.json();
  }

  // Map kid to imported key
  const kidToKey: Record<string, CryptoKey> = {};
  await Promise.all(
    jwks.keys.map(async (key: Jwk) => {
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
          throw new Error(`No matching JWK found for kid: ${header.kid}`);
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
      sub: (payload.sub as string | undefined) || (payload.user_id as string | undefined),
    };
  } catch (error: any) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      console.warn('Firebase token has expired.');
      return null;
    }
    logError(error, 'Error verifying Firebase token');
    throw new Error('Token inválido o expirado');
  }
}
