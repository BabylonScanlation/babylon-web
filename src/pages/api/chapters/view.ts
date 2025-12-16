// src/pages/api/chapters/view.ts
import type { APIRoute } from 'astro';

interface ViewRequestBody {
  chapterId: number;
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  try {
    const { chapterId } = (await request.json()) as ViewRequestBody;
    if (!chapterId) {
      return new Response('Se requiere chapterId', { status: 400 });
    }

    const db = locals.runtime.env.DB;
    const ipAddress = clientAddress;

    // 1. Intenta insertar la vista usando la ip_address.
    const insertResult = await db
      .prepare(
        'INSERT OR IGNORE INTO ChapterViews (chapter_id, ip_address) VALUES (?, ?)'
      )
      .bind(chapterId, ipAddress)
      .run();

    // 2. Si la inserción fue exitosa (se añadió una fila nueva),
    // incrementa el contador de vistas en la tabla Chapters.
    if (insertResult.meta.changes > 0) {
      await db
        .prepare('UPDATE Chapters SET views = views + 1 WHERE id = ?')
        .bind(chapterId)
        .run();
    }

    return new Response('OK');
  } catch (e) {
    console.error('Error al registrar la vista:', e);
    return new Response('Error al registrar la vista del capítulo', {
      status: 500,
    });
  }
};
