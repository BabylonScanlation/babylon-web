// src/pages/api/delete-chapters.ts
import { createApiRoute } from '../../lib/api';
import { chapters, pages } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { APIContext } from 'astro'; // Import APIContext

export const POST = createApiRoute(
  { auth: 'admin' },
  async (context: APIContext) => { // Use context directly
    const { locals, request } = context; // Destructure locals and request from context
    const r2Cache = locals.runtime.env.R2_CACHE;
    const formData = await request.formData();
    const chapterId = formData.get('chapterId')?.toString();

    if (!chapterId) {
      return new Response(JSON.stringify({ error: 'ID de capítulo no proporcionado' }), { status: 400 });
    }

    // Get page image URLs to delete from R2
    const pagesToDelete = await locals.db!
      .select({ imageUrl: pages.imageUrl })
      .from(pages)
      .where(eq(pages.chapterId, parseInt(chapterId)))
      .all();

    if (pagesToDelete.length > 0) {
      const pageKeys = pagesToDelete.map(
        (p: { imageUrl: string }) => p.imageUrl.split('/').pop() || p.imageUrl
      ).filter((key: string) => key); // Ensure no empty keys
      
      if (pageKeys.length > 0 && r2Cache) {
         await r2Cache.delete(pageKeys);
      }
    }

    // Delete from database
    // The foreign key with ON DELETE CASCADE should handle deleting `pages` automatically,
    // but explicit deletion is safer if the constraint is not guaranteed.
    await locals.db!.delete(pages).where(eq(pages.chapterId, parseInt(chapterId))).run();
    await locals.db!.delete(chapters).where(eq(chapters.id, parseInt(chapterId))).run();

    return new Response(JSON.stringify({ success: true, message: 'Capítulo eliminado con éxito' }), { status: 200 });
  }
);
