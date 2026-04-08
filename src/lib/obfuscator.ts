// src/lib/obfuscator.ts

const SALT = 'B4byl0n_V2_Nucl3ar_S3cur1ty_';

/**
 * Astra Orion: Ofuscación Nuclear (Rolling XOR)
 * Optimizada para Cloudflare Workers (Máximo rendimiento con Uint8Array).
 * Mucho más difícil de revertir que un XOR fijo.
 */
function xorTransform(data: Uint8Array): Uint8Array {
  const keyBuffer = new TextEncoder().encode(SALT);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    // Usamos el SALT como llave rotativa (Vigenère XOR)
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
 */
export function obfuscate(data: any): string {
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    const salted = SALT + str;
    const dataBuffer = new TextEncoder().encode(salted);
    const transformed = xorTransform(dataBuffer);
    
    // Convertir a Base64 de forma eficiente
    let binary = '';
    const len = transformed.byteLength;
    for (let i = 0; i < len; i++) {
      const byte = transformed[i];
      if (byte !== undefined) {
        binary += String.fromCharCode(byte);
      }
    }
    
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (e) {
    console.error('[Obfuscator] Error obfuscating:', e);
    return '';
  }
}

/**
 * De-obfuscates the payload.
 */
export function deobfuscate(encryptedStr: string): any {
  try {
    let base64 = encryptedStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';

    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const decryptedBuffer = xorTransform(bytes);
    const decoded = new TextDecoder().decode(decryptedBuffer);

    if (!decoded.startsWith(SALT)) {
      return null;
    }

    const content = decoded.slice(SALT.length);
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  } catch (e) {
    return null;
  }
}
