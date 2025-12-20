// src/pages/api/update-chapter.ts
import { createApiRoute } from '../../lib/api';
import { chapters } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { APIContext } from 'astro';

export const POST = createApiRoute(
  { auth: 'admin' },
  async (context: APIContext) => { // Use context directly
    const { locals, request } = context; // Destructure locals and request from context
    const formData = await request.formData();
    const chapterId = formData.get('chapterId')?.toString();
    const title = formData.get('title')?.toString() || null;

    if (!chapterId) {
      return new Response(JSON.stringify({ error: 'ID de capítulo no proporcionado' }), { status: 400 });
    }

    await locals.db!.update(chapters)
      .set({ title })
      .where(eq(chapters.id, parseInt(chapterId)))
      .run();

    return new Response(JSON.stringify({ success: true, message: 'Título del capítulo actualizado con éxito' }), { status: 200 });
  }
);
