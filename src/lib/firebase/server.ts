// src/lib/firebase/server.ts
import { jwtVerify, importJWK } from 'jose';

const JWKS_URL =
  'https://www.googleapis.com/service_account/v1/jwk/securetoken.google.com';

export async function verifyFirebaseToken(token: string, env: any) {
  const projectIdToUse = env.FIREBASE_PROJECT_ID;

  if (!projectIdToUse) {
    throw new Error(
      'La variable de entorno FIREBASE_PROJECT_ID no está configurada.'
    );
  }

  // Usar fetch nativo para obtener las claves públicas
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
  const jwks: { keys: any[] } = await res.json();

  // Verificar que jwks tiene la propiedad 'keys' y es un array
  if (!jwks || !Array.isArray(jwks.keys)) {
    throw new Error('El JWKS obtenido no tiene el formato esperado.');
  }

  // Crear un mapa de claves por 'kid'
  const keyMap: Record<string, any> = {};
  await Promise.all(
    jwks.keys.map(async (key: any) => {
      keyMap[key.kid] = await importJWK(key, 'RS256');
    })
  );

  try {
    const { payload } = await jwtVerify(
      token,
      async (protectedHeader: { kid?: string }) => {
        const kid = protectedHeader.kid;
        if (!kid) {
          throw new Error(
            'No se encontró el identificador de clave (kid) en el encabezado protegido.'
          );
        }
        const key = keyMap[kid];
        if (!key) {
          throw new Error(
            'No se encontró la clave pública para el kid proporcionado.'
          );
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
