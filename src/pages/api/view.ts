// src/pages/api/view.ts
import type { APIRoute } from 'astro';
import { logError } from '../../lib/logError';
import { getDB } from '../../lib/db';
import { series, seriesViews } from '../../db/schema'; // Importar el esquema
import { sql, eq } from 'drizzle-orm';

interface ViewRequestBody {
  seriesId: number;
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  let seriesId: number | undefined; // Declare seriesId here
  try {
    const requestBody = (await request.json()) as ViewRequestBody;
    seriesId = requestBody.seriesId; // Assign seriesId here

    if (!seriesId) {
      return new Response('Se requiere seriesId', { status: 400 });
    }

    const drizzleDb = getDB(locals.runtime.env);
    const ipAddress = clientAddress;

    // 1. Intentamos insertar la vista en la nueva tabla usando Drizzle.
    const insertResult = await drizzleDb.insert(seriesViews)
      .values({ seriesId, ipAddress, viewedAt: sql`CURRENT_TIMESTAMP` })
      .onConflictDoNothing({ target: [seriesViews.seriesId, seriesViews.ipAddress] })
      .run();

    // 2. Solo si la inserción fue exitosa (es decir, se añadió una nueva fila),
    // incrementamos el contador de vistas en la tabla Series.
    // Drizzle devuelve `changes` en `meta` para D1.
    if (insertResult.meta.changes > 0) {
      await drizzleDb.update(series)
        .set({ views: sql`${series.views} + 1` }) // Increment views
        .where(eq(series.id, seriesId))
        .run();
    }

    return new Response('OK');
  } catch (e: unknown) {
    const ipAddressForLog = clientAddress; // ipAddress is always available
    logError(e, 'Error al registrar la vista de la serie', { seriesId, ipAddress: ipAddressForLog });
    return new Response('Error al registrar la vista', { status: 500 });
  }
};
