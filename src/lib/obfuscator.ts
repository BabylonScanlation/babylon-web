// src/lib/obfuscator.ts

const SALT = 'B4byl0n_V2_Nucl3ar_S3cur1ty_';

/**
 * Obfuscates a string or object into a URL-safe Base64 string with a salt.
 */
export function obfuscate(data: any): string {
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    const salted = SALT + str;
    
    let base64: string;
    if (typeof Buffer !== 'undefined') {
      base64 = Buffer.from(salted).toString('base64');
    } else {
      const bytes = new TextEncoder().encode(salted);
      const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
      base64 = btoa(binString);
    }
    // Make it URL safe
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
    // Restore standard Base64
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

    if (!decoded.startsWith(SALT)) {
      return null;
    }

    const content = decoded.slice(SALT.length);
    try {
      return JSON.parse(content);
    } catch {
      return content; // Return as plain string if not JSON
    }
  } catch (e) {
    return null;
  }
}
