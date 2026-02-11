import { createApiRoute } from '../../../lib/api';
import { anonymousUsers } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { hashIpAddress } from '../../../lib/crypto';
import { generateUUID } from '../../../lib/utils';

export const POST = createApiRoute({ auth: 'public' }, async ({ request, locals, cookies }) => {
  const { fingerprint } = await request.json() as { fingerprint: string };
  const db = locals.db;
  const rawIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ip = await hashIpAddress(rawIp); // Anonymize IP
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const country = request.headers.get('CF-IPCountry') || null;

  let guestId = cookies.get('guestId')?.value;
  let isNew = false;
  let restored = false;

  // Level 1: Cookie Check (Explicit Identity)
  // If we have a cookie, we trust it primarily.

  // Level 2: Fingerprint Recovery (Implicit Identity)
  // If no cookie, we check if this device is recognized.
  if (!guestId && fingerprint) {
    try {
      const existingUser = await db.select()
        .from(anonymousUsers)
        .where(eq(anonymousUsers.fingerprintHash, fingerprint))
        .get();
      
      if (existingUser) {
        guestId = existingUser.guestId;
        restored = true;
      }
    } catch (e) {
      console.error('Error searching fingerprint:', e);
    }
  }

  // Level 3: Registration (New Identity)
  if (!guestId) {
    guestId = generateUUID();
    isNew = true;
    
    try {
      await db.insert(anonymousUsers).values({
        guestId,
        fingerprintHash: fingerprint || null,
        lastIpAddress: ip,
        userAgent: userAgent,
        country: country
      });
    } catch (e) {
      console.error('Error creating anonymous user:', e);
    }
  } else {
    // Maintenance: Update IP/UA/Country and ensure DB record exists
    try {
      const valuesToUpdate: any = {
        lastIpAddress: ip,
        userAgent: userAgent,
        country: country, // Update country on return
        updatedAt: new Date().toISOString()
      };
      
      if (fingerprint) {
        valuesToUpdate.fingerprintHash = fingerprint;
      }

      await db.insert(anonymousUsers).values({
        guestId, 
        fingerprintHash: fingerprint || null,
        lastIpAddress: ip,
        userAgent: userAgent,
        country: country
      }).onConflictDoUpdate({
        target: anonymousUsers.guestId,
        set: valuesToUpdate
      });
    } catch {
      // Logic for conflict handling remains similar...
      try {
        await db.update(anonymousUsers)
          .set({ 
            lastIpAddress: ip, 
            userAgent: userAgent, 
            country: country, // Update country fallback
            updatedAt: new Date().toISOString() 
          })
          .where(eq(anonymousUsers.guestId, guestId));
      } catch (inner) {
        console.error('Error updating anonymous user meta:', inner);
      }
    }
  }

  const url = new URL(request.url);
  const isLocalIp = url.hostname.startsWith('192.168.') || url.hostname.startsWith('10.') || url.hostname.startsWith('172.');
  const isProduction = import.meta.env.PROD;

  // Set/Refresh Cookie
  cookies.set('guestId', guestId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: false, 
    secure: isProduction && !isLocalIp,
    sameSite: 'lax'
  });

  return new Response(JSON.stringify({ guestId, restored, isNew }), { status: 200 });
});
