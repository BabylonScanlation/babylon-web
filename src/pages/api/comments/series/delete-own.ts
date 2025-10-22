// src/pages/api/comments/series/delete-own.ts
import type { APIRoute } from 'astro';
import { z } from 'zod';

const DeleteSchema = z.object({
  commentId: z.number().int().positive(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.uid) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = DeleteSchema.safeParse(body);

    if (!validation.success) {
      return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400 });
    }
    
    const { commentId } = validation.data;
    const db = locals.runtime.env.DB;

    // Verificamos que el comentario exista y pertenezca al usuario
    const comment = await db.prepare("SELECT user_id FROM SeriesComments WHERE id = ?")
      .bind(commentId)
      .first<{ user_id: string }>();

    console.log("Server user.uid:", user.uid);
    console.log("Comment user_id:", comment?.user_id);

    if (!comment) {
      return new Response(JSON.stringify({ error: "Comentario no encontrado" }), { status: 404 });
    }

    if (comment.user_id !== user.uid) {
      return new Response(JSON.stringify({ error: "No tienes permiso para eliminar este comentario" }), { status: 403 });
    }

    // Si todo es correcto, eliminamos el comentario
    await db.prepare("DELETE FROM SeriesComments WHERE id = ?").bind(commentId).run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (e: unknown) {
    console.error("Error al eliminar el comentario:", e);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
  }
};