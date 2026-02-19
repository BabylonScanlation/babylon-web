import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { users } from '../../../db/schema';
import { getDB } from '../../../lib/db';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !user.uid) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('avatar') as File;

    if (!file || !file.name) {
      return new Response(JSON.stringify({ error: 'No se seleccionó ninguna imagen.' }), {
        status: 400,
      });
    }

    // 1. Validaciones
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Formato no soportado. Usa JPG, PNG o WEBP.' }), {
        status: 400,
      });
    }

    if (file.size > 2 * 1024 * 1024) {
      // 2MB Limit
      return new Response(JSON.stringify({ error: 'La imagen es demasiado pesada (Máx 2MB).' }), {
        status: 400,
      });
    }

    const { env } = locals.runtime;
    const db = getDB(env);

    // 2. Obtener avatar anterior para borrarlo (Ahorro de espacio en R2)
    const currentUser = await db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, user.uid))
      .get();

    if (currentUser?.avatarUrl) {
      try {
        // Extraer la key del URL anterior si pertenece a nuestro R2
        // Ejemplo URL: https://assets.yourdomain.com/avatars/uid-123.jpg
        const urlObj = new URL(currentUser.avatarUrl);
        const key = urlObj.pathname.substring(1); // quitar el primer '/'

        // Solo borramos si parece estar en la carpeta avatars/
        if (key.startsWith('avatars/')) {
          await env.R2_ASSETS.delete(key);
        }
      } catch (err) {
        console.warn('No se pudo borrar el avatar anterior:', err);
        // No fallamos la request por esto, es mantenimiento
      }
    }

    // 3. Preparar nueva subida
    const ext = file.type.split('/')[1];
    const timestamp = Date.now();
    // Usamos el UID en el nombre para evitar colisiones, pero añadimos timestamp para evitar problemas de caché del navegador
    const key = `avatars/${user.uid}-${timestamp}.${ext}`;

    // 4. Subir a R2_ASSETS (Persistente)
    await env.R2_ASSETS.put(key, file, {
      httpMetadata: {
        contentType: file.type,
        // Cachear en navegador 1 año, pero permitir revalidación si cambia el nombre (que cambia por el timestamp)
        cacheControl: 'public, max-age=31536000',
      },
    });

    const publicUrl = `${env.R2_PUBLIC_URL_ASSETS}/${key}`;

    // 5. Actualizar Base de Datos
    await db
      .insert(users)
      .values({
        id: user.uid,
        email: user.email || 'no-email',
        avatarUrl: publicUrl,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          avatarUrl: publicUrl,
          updatedAt: new Date(),
        },
      })
      .run();

    return new Response(JSON.stringify({ success: true, avatarUrl: publicUrl }), { status: 200 });
  } catch (e) {
    console.error('Avatar Upload Error:', e);
    return new Response(JSON.stringify({ error: 'Error interno al subir la imagen.' }), {
      status: 500,
    });
  }
};
