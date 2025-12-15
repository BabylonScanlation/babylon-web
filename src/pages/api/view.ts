// src/pages/api/view.ts
import type { APIRoute } from 'astro';

interface ViewRequestBody {
  seriesId: number;
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  try {
    const { seriesId } = (await request.json()) as ViewRequestBody;
    if (!seriesId) {
      return new Response('Se requiere seriesId', { status: 400 });
    }

    const db = locals.runtime.env.DB;
    // Usamos clientAddress que Astro nos proporciona para obtener la IP del visitante.
    const ipAddress = clientAddress;

    // 1. Intentamos insertar la vista en la nueva tabla.
    // "INSERT OR IGNORE" es clave: si el par (seriesId, ipAddress) ya existe,
    // la consulta simplemente no hará nada y no dará error.
    const insertResult = await db
      .prepare(
        'INSERT OR IGNORE INTO SeriesViews (series_id, ip_address) VALUES (?, ?)'
      )
      .bind(seriesId, ipAddress)
      .run();

    // 2. Solo si la inserción fue exitosa (es decir, se añadió una nueva fila),
    // incrementamos el contador de vistas en la tabla Series.
    // El valor `insertResult.meta.changes` será 1 si la fila era nueva, y 0 si ya existía.
    if (insertResult.meta.changes > 0) {
      await db
        .prepare('UPDATE Series SET views = views + 1 WHERE id = ?')
        .bind(seriesId)
        .run();
    }

    return new Response('OK');
  } catch (e) {
    console.error(e);
    return new Response('Error al registrar la vista', { status: 500 });
  }
};
