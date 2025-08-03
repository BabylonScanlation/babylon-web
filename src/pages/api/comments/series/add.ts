// src/pages/api/comments/series/add.ts
import type { APIRoute } from 'astro';
import { z } from 'zod';

const CommentSchema = z.object({
  seriesId: z.number().int().positive(),
  commentText: z.string().min(1, "El comentario не puede estar vacío.").max(1000, "El comentario no puede exceder los 1000 caracteres."),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;

  // ✅ CORRECCIÓN: Se valida solo el UID del usuario, no el email.
  if (!user || !user.uid) {
    return new Response(JSON.stringify({ error: "No autorizado. Debes iniciar sesión para comentar." }), { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = CommentSchema.safeParse(body);

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || "Datos inválidos.";
      return new Response(JSON.stringify({ error: errorMessage }), { status: 400 });
    }
    
    const { seriesId, commentText } = validation.data;
    const db = locals.runtime.env.DB;

    // ✅ CORRECCIÓN: Se proporciona un email alternativo si no está disponible.
    const userEmail = user.email || `user-${user.uid.substring(0, 8)}`;

    const result = await db.prepare(
      "INSERT INTO SeriesComments (series_id, user_id, user_email, comment_text) VALUES (?, ?, ?, ?)"
    ).bind(seriesId, user.uid, userEmail, commentText).run();

    const newComment = {
        id: result.meta.last_row_id,
        user_email: userEmail,
        comment_text: commentText,
        created_at: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(newComment), { status: 201 });

  } catch (e: any) {
    console.error("Error al añadir comentario de serie:", e);
    return new Response(JSON.stringify({ error: "Error interno del servidor." }), { status: 500 });
  }
};