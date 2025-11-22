// src/pages/api/chapters/view.ts
import type { APIRoute } from 'astro';

interface ViewRequestBody {
  chapterId: number;
}

export const POST: APIRoute = async ({ request, locals, cookies, clientAddress }) => {
  try {
    const { chapterId } = (await request.json()) as ViewRequestBody;
    if (!chapterId) {
      return new Response('Se requiere chapterId', { status: 400 });
    }

    const db = locals.runtime.env.DB;

    // --- Lógica de Identidad de Invitado ---
    let guestId = cookies.get('guest_id')?.value;

    if (!guestId) {
      // Si no hay cookie, es un visitante nuevo o uno que limpió sus datos.
      guestId = crypto.randomUUID();
      console.log(`Nuevo guest_id generado: ${guestId}`);

      // Guardamos el nuevo usuario anónimo en la base de datos
      await db.prepare(
        'INSERT INTO AnonymousUsers (guest_id, last_ip_address) VALUES (?, ?)'
      ).bind(guestId, clientAddress).run();

      // Establecemos la cookie para futuras visitas
      cookies.set('guest_id', guestId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365 * 2, // 2 años
        httpOnly: true,
        secure: import.meta.env.PROD, // Solo secure en producción
      });
    }

    // --- Registro de Vista con guest_id ---
    // 1. Intenta insertar la vista usando el guest_id.
    const insertResult = await db
      .prepare(
        'INSERT OR IGNORE INTO ChapterViews (chapter_id, guest_id) VALUES (?, ?)'
      )
      .bind(chapterId, guestId)
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
