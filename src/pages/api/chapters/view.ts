import type { APIRoute } from 'astro';
import { logError } from '@lib/logError';
import { getDB } from '@lib/db';
import { chapters, chapterViews } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

interface ViewRequestBody {
  chapterId: number;
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  let chapterId: number | undefined; // Declare chapterId here

  try {
    const requestBody = (await request.json()) as ViewRequestBody;
    chapterId = requestBody.chapterId; // Assign chapterId here

    if (!chapterId) {
      return new Response('Se requiere chapterId', { status: 400 });
    }

    const drizzleDb = getDB(locals.runtime.env);
    const ipAddress = clientAddress;

    // 1. Intenta insertar la vista usando la ip_address.
    const insertResult = await drizzleDb.insert(chapterViews)
      .values({ chapterId, ipAddress, viewedAt: sql`CURRENT_TIMESTAMP` })
      .onConflictDoNothing({ target: [chapterViews.chapterId, chapterViews.ipAddress] })
      .run();

    // 2. Si la inserción fue exitosa (es decir, se añadió una nueva fila),
    // incrementamos el contador de vistas en la tabla Chapters.
    // Drizzle devuelve `changes` en `meta` para D1.
    if (insertResult.meta.changes > 0) {
      await drizzleDb.update(chapters)
        .set({ views: sql`${chapters.views} + 1` })
        .where(eq(chapters.id, chapterId))
        .run();
    }

    return new Response('OK');
  } catch (e: unknown) {
    const chapterIdForLog = chapterId; // Use the chapterId from the outer scope
    const ipAddressForLog = clientAddress;
    logError(e, 'Error al registrar la vista del capítulo', { chapterId: chapterIdForLog, ipAddress: ipAddressForLog });
    return new Response('Error al registrar la vista del capítulo', {
      status: 500,
    });
  }
};
