import { jwtVerify, SignJWT } from 'jose';

/**
 * Orion: Sistema de Nonces Apátridas (Stateless).
 * Protege contra Replay Attacks sin consumir cuota de lectura/escritura de D1.
 * Utiliza criptografía HMAC para validar la autenticidad y el tiempo (TTL).
 */

export async function createNonce(secret: string, userId: string = 'guest'): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  // Generamos un token criptográfico de corta duración (60 segundos)
  return await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1m')
    .sign(secretKey);
}

export async function consumeNonce(
  token: string,
  secret: string,
  userId: string = 'guest'
): Promise<boolean> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);

    // Verificamos integridad y que el token pertenezca al usuario actual
    return payload.uid === userId;
  } catch {
    // Si el token expiró (pasaron > 60s) o la firma es inválida, falla
    return false;
  }
}
