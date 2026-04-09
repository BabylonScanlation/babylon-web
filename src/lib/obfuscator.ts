// src/lib/obfuscator.ts

/**
 * Astra Orion: Ofuscación Nuclear (Rolling XOR)
 * Optimizada para Cloudflare Workers.
 */
function xorTransform(data: Uint8Array, salt: string): Uint8Array {
  const keyBuffer = new TextEncoder().encode(salt);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const dataByte = data[i];
    const keyByte = keyBuffer[i % keyBuffer.length];
    if (dataByte !== undefined && keyByte !== undefined) {
      out[i] = dataByte ^ keyByte;
    }
  }
  return out;
}

/**
 * Obfuscates data into a URL-safe Base64 string.
 * @param data Data to obfuscate
 * @param salt Secret salt (must be provided from env)
 */
export function obfuscate(data: any, salt: string): string {
  if (!salt) {
    console.error('[Obfuscator] No SALT provided for obfuscation');
    return '';
  }

  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    const salted = salt + str;
    const dataBuffer = new TextEncoder().encode(salted);
    const transformed = xorTransform(dataBuffer, salt);

    let binary = '';
    const len = transformed.byteLength;
    for (let i = 0; i < len; i++) {
      const byte = transformed[i];
      if (byte !== undefined) {
        binary += String.fromCharCode(byte);
      }
    }

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    console.error('[Obfuscator] Error obfuscating:', e);
    return '';
  }
}

/**
 * De-obfuscates the payload.
 * @param encryptedStr Obfuscated string
 * @param salt Secret salt (must be provided from env)
 */
export function deobfuscate(encryptedStr: string, salt: string): any {
  if (!salt) return null;

  try {
    let base64 = encryptedStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';

    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const decryptedBuffer = xorTransform(bytes, salt);
    const decoded = new TextDecoder().decode(decryptedBuffer);

    if (!decoded.startsWith(salt)) {
      return null;
    }

    const content = decoded.slice(salt.length);
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  } catch (e) {
    return null;
  }
}
