// src/pages/api/series/toggle-visibility.ts
import type { APIRoute } from 'astro';
import { z } from 'zod';

// Esquema para validar los datos que esperamos recibir
const ToggleVisibilitySchema = z.object({
  seriesId: z.number().int().positive(),
  isHidden: z.boolean(),
});

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  // 1. Verificar sesión de administrador
  if (cookies.get('session')?.value !== 'admin-logged-in') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const db = locals.runtime.env.DB;
    const body = await request.json();

    // 2. Validar los datos recibidos
    const validation = ToggleVisibilitySchema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { seriesId, isHidden } = validation.data;

    // 3. Actualizar la base de datos
    await db
      .prepare('UPDATE Series SET is_hidden = ? WHERE id = ?')
      .bind(isHidden, seriesId)
      .run();

    // 4. Devolver respuesta de éxito
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e: unknown) {
    console.error('Error al cambiar la visibilidad de la serie:', e);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};