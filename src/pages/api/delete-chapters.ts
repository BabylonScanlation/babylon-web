import type { APIContext } from 'astro';
import { eq } from 'drizzle-orm';
import { chapters, chapterViews, comments, pages } from '../../db/schema';
import { createApiRoute } from '../../lib/api';

export const POST = createApiRoute({ auth: 'admin' }, async (context: APIContext) => {
  const { locals, request } = context;
  const r2Cache = locals.runtime.env.R2_CACHE;

  let chapterIds: number[] = [];
  const contentType = request.headers.get('Content-Type') || '';

  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as any;
      if (body.chapterIds && Array.isArray(body.chapterIds)) {
        chapterIds = body.chapterIds.map((id: any) => parseInt(id));
      } else if (body.chapterId) {
        chapterIds = [parseInt(body.chapterId)];
      }
    } else {
      const formData = await request.formData();
      const chapterId = formData.get('chapterId')?.toString();
      if (chapterId) {
        chapterIds = [parseInt(chapterId)];
      }
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Formato de solicitud no válido.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (chapterIds.length === 0 || chapterIds.some(isNaN)) {
    return new Response(
      JSON.stringify({ error: 'No se proporcionaron IDs de capítulo válidos.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    for (const id of chapterIds) {
      // 1. Delete pages from R2
      const pagesToDelete = await locals
        .db!.select({ imageUrl: pages.imageUrl })
        .from(pages)
        .where(eq(pages.chapterId, id))
        .all();

      if (pagesToDelete.length > 0) {
        const pageKeys = pagesToDelete
          .map((p: { imageUrl: string }) => p.imageUrl.split('/').pop() || p.imageUrl)
          .filter((key: string) => key);

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
    }

    return new Response(
      JSON.stringify({
        success: true,
        message:
          chapterIds.length > 1
            ? `${chapterIds.length} capítulos eliminados`
            : 'Capítulo eliminado con éxito',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (e: any) {
    console.error('Error deleting chapter:', e);
    return new Response(
      JSON.stringify({ error: 'Error interno al intentar eliminar: ' + e.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
