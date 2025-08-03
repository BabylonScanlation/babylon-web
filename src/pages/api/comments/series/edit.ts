import type { APIRoute } from 'astro';
import { z } from 'zod';

const EditSchema = z.object({
  commentId: z.number().int().positive(),
  commentText: z.string().min(1, "El comentario no puede estar vacío.").max(1000, "El comentario no puede exceder los 1000 caracteres."),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.uid) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = EditSchema.safeParse(body);

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || "Datos inválidos.";
      return new Response(JSON.stringify({ error: errorMessage }), { status: 400 });
    }
    
    const { commentId, commentText } = validation.data;
    const db = locals.runtime.env.DB;

    // Primero, verificamos que el comentario pertenezca al usuario
    const comment = await db.prepare("SELECT user_id FROM SeriesComments WHERE id = ?")
      .bind(commentId)
      .first<{ user_id: string }>();

    if (!comment) {
      return new Response(JSON.stringify({ error: "Comentario no encontrado" }), { status: 404 });
    }

    if (comment.user_id !== user.uid) {
      return new Response(JSON.stringify({ error: "No tienes permiso para editar este comentario" }), { status: 403 });
    }

    // Si todo es correcto, actualizamos el comentario
    await db.prepare("UPDATE SeriesComments SET comment_text = ? WHERE id = ?")
      .bind(commentText, commentId)
      .run();

    const updatedComment = {
        id: commentId,
        comment_text: commentText,
    };

    return new Response(JSON.stringify(updatedComment), { status: 200 });

  } catch (e: any) {
    console.error("Error al editar el comentario:", e);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
  }
};