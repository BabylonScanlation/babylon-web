// src/lib/obfuscator.ts

const SALT = "B4byl0n_V2_Nucl3ar_S3cur1ty_";

/**
 * Obfuscates a JSON object into a Base64 string with a salt.
 * Used by the API to hide data structure and URLs from casual inspection.
 */
export function obfuscate(data: any): string {
    try {
        const jsonStr = JSON.stringify(data);
        const salted = SALT + jsonStr;
        // Use Buffer for Node/Astro/CF Workers environment
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(salted).toString('base64');
        } else {
            // Fallback for browser (UTF-8 safe)
            const bytes = new TextEncoder().encode(salted);
            const binString = Array.from(bytes, (byte) =>
                String.fromCodePoint(byte)
            ).join("");
            return btoa(binString);
        }
    } catch (e) {
        console.error('[Obfuscator] Error encrypting:', e);
        return "";
    }
}

/**
 * De-obfuscates the payload on the client side.
 */
export function deobfuscate(encryptedStr: string): any {
    try {
        let decoded: string;
        
        if (typeof Buffer !== 'undefined') {
             // Server-side / Node environment
            decoded = Buffer.from(encryptedStr, 'base64').toString('utf-8');
        } else if (typeof window !== 'undefined' && window.atob) {
            // Browser environment (UTF-8 safe)
            const binaryStr = window.atob(encryptedStr);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            decoded = new TextDecoder().decode(bytes);
        } else {
            return null;
        }

        if (!decoded.startsWith(SALT)) {
            console.warn('[Obfuscator] Invalid salt');
            return null;
        }

        const jsonStr = decoded.slice(SALT.length);
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('[Obfuscator] Error decrypting:', e);
        return null;
    }
}
