export async function hashIpAddress(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  // Orion: Usamos un salt dinámico de env vars para mayor seguridad y genericidad
  const salt = import.meta.env.INTERNAL_CRYPTO_SALT || 'default-cms-salt-v1'; 
  const data = encoder.encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Signs a path with an expiration timestamp.
 */
export async function signUrl(path: string, secret: string, ttlMs: number = 1000 * 60 * 60 * 2): Promise<string> {
    let pathToSign = path;
    try {
        const url = new URL(path, 'http://localhost');
        pathToSign = url.pathname;
    } catch {
        // Fallback
    }

    const expires = Date.now() + ttlMs;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const dataToSign = `${pathToSign}:${expires}`;
    const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(dataToSign)
    );
    
    const signature = Buffer.from(signatureBuffer)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
        
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}expires=${expires}&signature=${signature}`;
}

/**
 * Verifies if a path's signature is valid and hasn't expired.
 */
export async function verifySignature(pathWithoutParams: string, expires: string, signature: string, secret: string): Promise<boolean> {
    const expiresNum = parseInt(expires);
    if (isNaN(expiresNum) || Date.now() > expiresNum) {
        return false;
    }

    let cleanPath = pathWithoutParams;
    try {
        const url = new URL(pathWithoutParams, 'http://localhost');
        cleanPath = url.pathname;
    } catch {
        // Fallback
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
    );

    const dataToVerify = `${cleanPath}:${expires}`;
    
    try {
        // Restore base64url to standard base64 for Buffer
        const base64 = signature.replace(/-/g, '+').replace(/_/g, '/');
        const signatureBytes = Buffer.from(base64, 'base64');

        return await crypto.subtle.verify(
            'HMAC',
            key,
            signatureBytes,
            encoder.encode(dataToVerify)
        );
    } catch {
        return false;
    }
}

/**
 * Normalizes a URL to be absolute and prefixed with the R2 cache proxy if needed.
 */
function normalizeProxyUrl(url: string): string {
    if (url.startsWith('http')) return url;
    
    // Remove leading slash for consistent checking
    const cleanPath = url.startsWith('/') ? url.slice(1) : url;
    
    if (cleanPath.startsWith('api/r2-cache/')) {
        return `/${cleanPath}`;
    }
    
    // Add missing proxy prefix
    return `/api/r2-cache/${cleanPath}`;
}

/**
 * Signs all URLs inside a chapter manifest using the environment secret.
 */
export async function signManifest(manifest: any, envSecret: string | undefined): Promise<any> {
    console.log('[CRYPTO] signManifest: Starting manifest signing...');
    let secret = envSecret;
    if (typeof secret === 'string') {
        secret = secret.replace(/['"“”]/g, '').replace(/\\n/g, '').trim();
    }
    
    if (!secret) {
        console.error('[CRYPTO] signManifest: AUTH_SECRET is missing!');
        throw new Error('Critical Security Configuration Missing (AUTH_SECRET)');
    }
    
    // Support for modern manifest format (pages array)
    if (manifest.pages && Array.isArray(manifest.pages)) {
        console.log(`[CRYPTO] signManifest: Signing ${manifest.pages.length} pages (modern format)`);
        const signedPages = await Promise.all(
            manifest.pages.map(async (page: any, idx: number) => {
                // If page is just a string (legacy/edge case), normalize, sign and return as object
                if (typeof page === 'string') {
                    const normalizedUrl = normalizeProxyUrl(page);
                    const signedUrl = await signUrl(normalizedUrl, secret!);
                    return { imageUrl: signedUrl, pageNumber: idx + 1 };
                }

                const signedPage = { ...page };
                let urlToSign = page.imageUrl || page.url;
                
                if (urlToSign) {
                    urlToSign = normalizeProxyUrl(urlToSign);
                    const signedUrl = await signUrl(urlToSign, secret!);
                    if (page.imageUrl) signedPage.imageUrl = signedUrl;
                    else signedPage.url = signedUrl;
                } else {
                    console.warn(`[CRYPTO] signManifest: Page at index ${idx} is missing url/imageUrl. Structure: ${JSON.stringify(page)}`);
                }
                return signedPage;
            })
        );
        console.log('[CRYPTO] signManifest: Signing completed successfully.');
        return { ...manifest, pages: signedPages };
    } 
    
    // Fallback for legacy manifest format (imageUrls array)
    if (manifest.imageUrls && Array.isArray(manifest.imageUrls)) {
        console.log(`[CRYPTO] signManifest: Signing ${manifest.imageUrls.length} urls (legacy format)`);
        const signedImageUrls = await Promise.all(
            manifest.imageUrls.map(async (url: string) => {
                const normalizedUrl = normalizeProxyUrl(url);
                return await signUrl(normalizedUrl, secret!);
            })
        );
        console.log('[CRYPTO] signManifest: Legacy signing completed.');
        return { ...manifest, imageUrls: signedImageUrls };
    }

    console.warn('[CRYPTO] signManifest: No recognizable page structure found in manifest.');
    return manifest;
}
