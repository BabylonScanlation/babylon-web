// src/lib/obfuscator.ts

const SALT = 'B4byl0n_V2_Nucl3ar_S3cur1ty_';

/**
 * Astra Orion: Cifrado de Rotación Dinámica (Evita atob simple)
 */
function xorTransform(str: string): string {
  const key = 42; // Llave de transformación nuclear
  return str.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ key)).join('');
}

/**
 * Obfuscates a string or object into a URL-safe Base64 string with a salt and XOR.
 */
export function obfuscate(data: any): string {
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    const salted = SALT + str;
    const transformed = xorTransform(salted);
    
    let base64: string;
    if (typeof Buffer !== 'undefined') {
      base64 = Buffer.from(transformed).toString('base64');
    } else {
      const bytes = new TextEncoder().encode(transformed);
      const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
      base64 = btoa(binString);
    }
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    console.error('[Obfuscator] Error encrypting:', e);
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

    let decoded: string;
    if (typeof Buffer !== 'undefined') {
      decoded = Buffer.from(base64, 'base64').toString('utf-8');
    } else if (typeof window !== 'undefined' && window.atob) {
      const binaryStr = window.atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      decoded = new TextDecoder().decode(bytes);
    } else {
      return null;
    }

    const untransformed = xorTransform(decoded);
    if (!untransformed.startsWith(SALT)) {
      return null;
    }

    const content = untransformed.slice(SALT.length);
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  } catch (e) {
    return null;
  }
}
