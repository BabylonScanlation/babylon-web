// src/pages/api/update-chapter.ts

import type { APIContext } from 'astro';
import { eq } from 'drizzle-orm';
import { chapters } from '../../db/schema';
import { createApiRoute } from '../../lib/api';

export const POST = createApiRoute({ auth: 'admin' }, async (context: APIContext) => {
  const { locals, request } = context;

  let chapterId: string | null = null;
  let title: string | null = null;
  const contentType = request.headers.get('Content-Type') || '';

  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as any;
      chapterId = body.chapterId?.toString() || null;
      title = body.title?.toString() || null;
    } else {
      const formData = await request.formData();
      chapterId = formData.get('chapterId')?.toString() || null;
      title = formData.get('title')?.toString() || null;
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Formato de solicitud no válido.' }), {
      status: 400,
    });
  }

  if (!chapterId) {
    return new Response(JSON.stringify({ error: 'No se proporcionó el ID del capítulo.' }), {
      status: 400,
    });
  }

  await locals
    .db!.update(chapters)
    .set({ title })
    .where(eq(chapters.id, parseInt(chapterId)))
    .run();

  return new Response(
    JSON.stringify({ success: true, message: 'Título del capítulo actualizado con éxito' }),
    { status: 200 }
  );
});
