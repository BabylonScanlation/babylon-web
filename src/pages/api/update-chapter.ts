// src/pages/api/update-chapter.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({
  request,
  redirect,
  locals,
}) => {
  const referer = request.headers.get('Referer') || '/admin/series';

  // 1. Verificar la sesión de administrador
  if (!locals.user?.isAdmin) {
    return redirect('/admin?error=No autorizado');
  }

  try {
    const db = locals.runtime.env.DB;
    const formData = await request.formData();
    const chapterId = formData.get('chapterId')?.toString();
    const title = formData.get('title')?.toString() || null; // Usar null si el título está vacío

    // 2. Validar los datos del formulario
    if (!chapterId) {
      const errorUrl = new URL(referer);
      errorUrl.searchParams.set('error', 'ID de capítulo no proporcionado');
      return redirect(errorUrl.toString());
    }

    // 3. Actualizar la base de datos
    await db
      .prepare('UPDATE Chapters SET title = ? WHERE id = ?')
      .bind(title, chapterId)
      .run();

    // 4. Redirigir con mensaje de éxito
    const successUrl = new URL(referer);
    successUrl.searchParams.set(
      'success',
      'Título del capítulo actualizado con éxito'
    );
    return redirect(successUrl.toString());
  } catch (e: unknown) {
    console.error('Error al actualizar el título del capítulo:', e);
    const errorUrl = new URL(referer);
    errorUrl.searchParams.set(
      'error',
      `Error al actualizar el título: ${e instanceof Error ? e.message : String(e)}`
    );
    return redirect(errorUrl.toString());
  }
};
