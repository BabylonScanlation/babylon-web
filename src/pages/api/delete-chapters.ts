import { chapters, pages, comments, chapterViews } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { APIContext } from 'astro';

export const POST = createApiRoute(
  { auth: 'admin' },
  async (context: APIContext) => {
    const { locals, request } = context;
    const r2Cache = locals.runtime.env.R2_CACHE;
    const formData = await request.formData();
    const chapterId = formData.get('chapterId')?.toString();

    if (!chapterId) {
      return new Response(JSON.stringify({ error: 'ID de capítulo no proporcionado' }), { status: 400 });
    }

    const id = parseInt(chapterId);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
    }

    try {
      // 1. Delete pages from R2
      const pagesToDelete = await locals.db!
        .select({ imageUrl: pages.imageUrl })
        .from(pages)
        .where(eq(pages.chapterId, id))
        .all();

      if (pagesToDelete.length > 0) {
        const pageKeys = pagesToDelete.map(
          (p: { imageUrl: string }) => p.imageUrl.split('/').pop() || p.imageUrl
        ).filter((key: string) => key);
        
        if (pageKeys.length > 0 && r2Cache) {
           await r2Cache.delete(pageKeys).catch(console.error); // Ignore R2 errors
        }
      }

      // 2. Manual cleanup of dependencies (in case DB cascade is missing)
      await locals.db!.delete(pages).where(eq(pages.chapterId, id)).run();
      await locals.db!.delete(comments).where(eq(comments.chapterId, id)).run();
      await locals.db!.delete(chapterViews).where(eq(chapterViews.chapterId, id)).run();

      // 3. Delete the chapter
      await locals.db!.delete(chapters).where(eq(chapters.id, id)).run();

      return new Response(JSON.stringify({ success: true, message: 'Capítulo eliminado con éxito' }), { status: 200 });
    } catch (e: any) {
      console.error('Error deleting chapter:', e);
      return new Response(JSON.stringify({ error: 'Error interno al eliminar: ' + e.message }), { status: 500 });
    }
  }
);
