import { getDB } from '@lib/db';
import { logError } from '@lib/logError';
import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { chapterViews } from '@/db/schema';
import { hashIpAddress } from '@/lib/crypto';

export const POST: APIRoute = async ({ request, locals, clientAddress, cookies }) => {
  try {
    const { chapterId } = (await request.json()) as { chapterId: number };
    if (!chapterId) return new Response('OK');

    const env = locals.runtime.env;
    const kv = env.KV_VIEWS;
    const guestId = cookies.get('guestId')?.value || null;
    const userId = locals.user?.uid || null;

    const runBackgroundLogic = async () => {
      try {
        const ipHash = await hashIpAddress(clientAddress || '0.0.0.0');
        const viewKey = `cv:${chapterId}:${ipHash}`;

        // 1. Gatekeeper KV (Evitar D1 a toda costa)
        if (kv) {
          const alreadyViewed = await kv.get(viewKey);
          if (alreadyViewed) return;

          // Marcamos en KV (TTL 24h)
          await kv.put(viewKey, '1', { expirationTtl: 86400 });
        }

        // 2. Insert en D1 (Solo si KV no nos frenó)
        const drizzleDb = getDB(env);
        await drizzleDb
          .insert(chapterViews)
          .values({
            chapterId,
            ipAddress: ipHash,
            guestId,
            userId,
            viewedAt: sql`CURRENT_TIMESTAMP`,
          })
          .onConflictDoNothing()
          .run();
      } catch (err) {
        logError(err, '[Chapter View API] Background Error', { chapterId });
      }
    };

    // Respondemos OK inmediatamente (UX Flawless)
    if (locals.runtime.ctx?.waitUntil) {
      locals.runtime.ctx.waitUntil(runBackgroundLogic());
    } else {
      setTimeout(runBackgroundLogic, 0);
    }

    return new Response('OK');
  } catch {
    return new Response('OK');
  }
};
